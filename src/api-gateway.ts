import { Duration } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Metric, MetricOptions, ComparisonOperator, GraphWidget, HorizontalAnnotation, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';

import { Construct } from 'constructs';
import { IWatchful } from './api';

export interface WatchApiGatewayOptions {
  /**
   * Flag to disable alerting
   *
   * @default false
   */
  readonly disableAlerts?: boolean;

  /**
   * Alarm when 5XX errors reach this threshold within alarmPeriod.
   *
   * @default 1 any 5xx HTTP response will trigger the alarm
   */
  readonly serverErrorThreshold?: number;

  /**
   * The period over which the 5XX error alarm's metric is evaluated.
   *
   * @default Duration.minutes(5)
   */
  readonly alarmPeriod?: Duration;

  /**
   * The number of periods (of alarmPeriod each) over which the metric is compared
   * to the threshold.
   *
   * @default 1
   */
  readonly alarmEvaluationPeriods?: number;

  /**
   * The number of data points within alarmEvaluationPeriods that must breach the
   * threshold for the alarm to fire. Set this lower than alarmEvaluationPeriods to
   * require a sustained breach (e.g. 3 of 5 periods) instead of alarming on every
   * isolated breach.
   *
   * @default - same as alarmEvaluationPeriods (every period must breach)
   */
  readonly alarmDatapointsToAlarm?: number;

  /**
   * How the alarm treats missing data points.
   *
   * @default - CloudWatch's own default (TreatMissingData.MISSING)
   */
  readonly alarmTreatMissingData?: TreatMissingData;

  /**
   * Custom alarm description. Use this to point on-call at what the alarm means
   * and where to look, instead of the default's bare threshold value.
   *
   * @default `at ${serverErrorThreshold}`
   */
  readonly alarmDescription?: string;

  /**
   * A list of operations to monitor separately.
   *
   * @default - only API-level monitoring is added.
   */
  readonly watchedOperations?: WatchedOperation[];

  /**
   * Include a dashboard graph for caching metrics
   *
   * @default false
   */
  readonly cacheGraph?: boolean;
}

export interface WatchApiGatewayProps extends WatchApiGatewayOptions {
  /**
   * The title of this section.
   */
  readonly title: string;

  /**
   * The Watchful instance to add widgets into.
   */
  readonly watchful: IWatchful;

  /**
   * The API Gateway REST API that is being watched.
   */
  readonly restApi: apigw.RestApi;
}

export class WatchApiGateway extends Construct {
  private readonly api: apigw.CfnRestApi;
  private readonly stage: string;
  private readonly watchful: IWatchful;

  constructor(scope: Construct, id: string, props: WatchApiGatewayProps) {
    super(scope, id);

    this.api = props.restApi.node.findChild('Resource') as apigw.CfnRestApi;
    this.stage = props.restApi.deploymentStage.stageName;
    this.watchful = props.watchful;

    const alarmThreshold = props.serverErrorThreshold == null ? 1 : props.serverErrorThreshold;
    const addAlarm = props.disableAlerts == null ? true : !props.disableAlerts;
    if (addAlarm) {
      const metric = new Metric({
        namespace: 'AWS/ApiGateway',
        metricName: ApiGatewayMetric.FiveHundredError,
        statistic: 'sum',
        period: props.alarmPeriod ?? Duration.minutes(5),
      });
      let apigmetric = this.createApiGatewayMetric(ApiGatewayMetric.FiveHundredError, undefined, metric);
      this.watchful.addAlarm(
        apigmetric.createAlarm(this, '5XXErrorAlarm', {
          alarmDescription: props.alarmDescription ?? `at ${alarmThreshold}`,
          threshold: alarmThreshold,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: props.alarmEvaluationPeriods ?? 1,
          datapointsToAlarm: props.alarmDatapointsToAlarm,
          treatMissingData: props.alarmTreatMissingData,
        }),
      );
    }

    this.watchful.addSection(props.title, {
      links: [{ title: 'Amazon API Gateway Console', url: linkForApiGateway(props.restApi) }],
    });
    [undefined, ...props.watchedOperations || []].forEach(operation =>
      this.watchful.addWidgets(
        this.createCallGraphWidget(addAlarm, operation, alarmThreshold),
        ...props.cacheGraph ? [this.createCacheGraphWidget(operation)] : [],
        this.createLatencyGraphWidget(ApiGatewayMetric.Latency, operation),
        this.createLatencyGraphWidget(ApiGatewayMetric.IntegrationLatency, operation),
      ),
    );
  }

  private createCallGraphWidget( addAlarm: boolean, opts?: WatchedOperation, alarmThreshold?: number) {
    const leftAnnotations: HorizontalAnnotation[] = addAlarm && alarmThreshold
      ? [{ value: alarmThreshold, color: '#ff0000', label: '5XX Errors Alarm' }]
      : [];

    return new GraphWidget({
      title: `${opts ? `${opts.httpMethod} ${opts.resourcePath}` : 'Overall'} Calls/min`,
      width: 12,
      stacked: false,
      left: [
        this.createApiGatewayMetric(ApiGatewayMetric.Count, opts, { label: 'Calls', statistic: 'sum', color: '#1f77b4' }),
        this.createApiGatewayMetric(ApiGatewayMetric.FourHundredError, opts, { label: 'HTTP 4XX', statistic: 'sum', color: '#ff7f0e' }),
        this.createApiGatewayMetric(ApiGatewayMetric.FiveHundredError, opts, { label: 'HTTP 5XX', statistic: 'sum', color: '#d62728' }),
      ],
      leftAnnotations,
    });
  }

  private createCacheGraphWidget(opts?: WatchedOperation) {
    return new GraphWidget({
      title: `${opts ? `${opts.httpMethod} ${opts.resourcePath}` : 'Overall'} Cache/min`,
      width: 12,
      stacked: false,
      left: [
        this.createApiGatewayMetric(ApiGatewayMetric.Count, opts, { label: 'Calls', statistic: 'sum', color: '#1f77b4' }),
        this.createApiGatewayMetric(ApiGatewayMetric.CacheHitCount, opts, { label: 'Cache Hit', statistic: 'sum', color: '#2ca02c' }),
        this.createApiGatewayMetric(ApiGatewayMetric.CacheMissCount, opts, { label: 'Cache Miss', statistic: 'sum', color: '#d62728' }),
      ],
    });
  }

  private createLatencyGraphWidget(metric: ApiGatewayMetric, opts?: WatchedOperation) {
    return new GraphWidget({
      title: `${opts ? `${opts.httpMethod} ${opts.resourcePath}` : 'Overall'} ${metric} (1-minute periods)`,
      width: 12,
      stacked: false,
      left: ['min', 'avg', 'p90', 'p99', 'max'].map(statistic =>
        this.createApiGatewayMetric(metric, opts, { label: statistic, statistic })),
    });
  }

  private createApiGatewayMetric(
    metricName: ApiGatewayMetric,
    opts?: WatchedOperation,
    metricOpts?: MetricOptions,
  ): Metric {
    var api_name = this.api.name;
    if (api_name == undefined) {
      api_name = '';
    }
    return new Metric({
      dimensionsMap: {
        ApiName: api_name,
        Stage: this.stage,
        ...opts && {
          Method: opts.httpMethod,
          Resource: opts.resourcePath,
        },
      },
      metricName,
      namespace: 'AWS/ApiGateway',
      period: Duration.minutes(1),
      ...metricOpts,
    });
  }
}

/**
 * An operation (path and method) worth monitoring.
 */
export interface WatchedOperation {
  /**
   * The HTTP method for the operation (GET, POST, ...)
   */
  readonly httpMethod: string;

  /**
   * The REST API path for this operation (/, /resource/{id}, ...)
   */
  readonly resourcePath: string;
}

const enum ApiGatewayMetric {
  FourHundredError = '4XXError',
  FiveHundredError = '5XXError',
  CacheHitCount = 'CacheHitCount',
  CacheMissCount = 'CacheMissCount',
  Count = 'Count',
  IntegrationLatency = 'IntegrationLatency',
  Latency = 'Latency',
}

function linkForApiGateway(api: apigw.IRestApi) {
  return `https://console.aws.amazon.com/apigateway/home?region=${api.stack.region}#/apis/${api.restApiId}/resources`;
}

