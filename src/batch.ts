import * as batch from '@aws-cdk/aws-batch';
import * as events from '@aws-cdk/aws-events';
import * as events_targets from '@aws-cdk/aws-events-targets';
import * as sns from '@aws-cdk/aws-sns';
import { Construct, Duration } from '@aws-cdk/core';
import { IWatchful } from './api';

const DEFAULT_DURATION_THRESHOLD_PERCENT = 80;

export interface WatchBatchJobsOptions {
  /**
   * Flag to disable alerting on errors
   *
   * @default false
   */
  readonly errorsDisableAlerts?: boolean;

  /**
   * Number of allowed errors per minute. If there are more errors than that, an alarm will trigger.
   *
   * @default 0
   */
  readonly errorsPerMinuteThreshold?: number;

  /**
   * Flag to enable alerting on invocationsMetric
   *
    @default false
   */
  readonly invocationsEnableAlerts?: boolean;

  /**
   * Threshold for alerting invocations
   */
  readonly invocationsThreshold?: Duration;

  /**
   * Number of allowed throttles per minute.
   *
   * @default 0
   */
  readonly throttlesPerMinuteThreshold?: number;

  /**
   * Threshold for the duration alarm as percentage of the function's timeout
   * value.
   *
   * If this is set to 50%, the alarm will be set when p99 latency of the
   * function exceeds 50% of the function's timeout setting.
   *
   * @default 80
   */
  readonly durationThresholdPercent?: number;

  /**
   * Override duration timeout threshold.
   * Necessary for lambdas that aren't created via the CDK.
   * This value is still adjusted by durationThresholdPercent
   *
   * @default 3
   */
  readonly durationTimeoutSec?: number;

  /**
   * Send notifications to resolve alerts
   *
   * @default false
   */
  readonly autoResolveEvents?: boolean;
}

export interface WatchBatchJobsProps extends WatchBatchJobsOptions {
  readonly title: string;
  readonly watchful: IWatchful;
  readonly batchQueue: batch.IJobQueue;
  readonly alarmTopic: sns.ITopic;
}

export class WatchBatchJobs extends Construct {

  private readonly batchQueue: batch.IJobQueue;
  private readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: WatchBatchJobsProps) {
    super(scope, id);

    this.batchQueue = props.batchQueue;
    this.alarmTopic = props.alarmTopic;

    // this.watchful.addSection(props.title, {
    //   links: [
    //     { title: 'AWS Lambda Console', url: linkForLambdaFunction(this.fn) },
    //     { title: 'CloudWatch Logs', url: linkForLambdaLogs(this.fn) },
    //   ],
    // });

    this.createFailedJobsMonitor();
  }

    createFailedJobsMonitor() {
        const batchQueue = this.batchQueue;
        new events.Rule(this, 'FailedJobsRule', {
            eventPattern: {
                source: ['aws.batch'],
                detailType: ['Batch Job State Change'],
                detail: {
                    status: ['FAILED'],
                    jobQueue: [batchQueue.jobQueueName],
                },
            },
            targets: [new events_targets.SnsTopic(this.alarmTopic)],
        });
    }

    createStuckJobsMonitor() {
        const batchQueue = this.batchQueue;
        new events.Rule(this, 'StuckJobsRule', {
            eventPattern: {
                source: ['aws.batch'],
                detailType: ['Batch Job Queue Blocked'],
                detail: {
                    jobQueue: [batchQueue.jobQueueName],
                },
            },
            targets: [new events_targets.SnsTopic(this.alarmTopic, {
                message: events.RuleTargetInput.fromObject({
                    message: 'Batch job stuck in RUNNABLE state',
                    jobQueue: batchQueue.jobQueueName,
                }),
            })],
        });
    }
}

// function linkForLambdaFunction(fn: lambda.IFunction, tab = 'graph') {
//   return `https://console.aws.amazon.com/lambda/home?region=${fn.stack.region}#/functions/${fn.functionName}?tab=${tab}`;
// }

// function linkForLambdaLogs(fn: lambda.IFunction) {
//   return `https://console.aws.amazon.com/cloudwatch/home?region=${fn.stack.region}#logEventViewer:group=/aws/lambda/${fn.functionName}`;
// }