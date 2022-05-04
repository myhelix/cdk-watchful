import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import { Construct } from 'constructs';
import { IWatchful } from './api';

export interface WatchFirehoseServiceOptions {
  readonly autoResolveEvents?: boolean;
}

export interface WatchFirehoseServiceProps extends WatchFirehoseServiceOptions {
  readonly title: string;
  readonly watchful: IWatchful;
  readonly fh: firehose.CfnDeliveryStream;
}

export class WatchFirehoseService extends Construct {
  private readonly watchful: IWatchful;
  private readonly fh: firehose.CfnDeliveryStream;
  private readonly autoResolveEvents: boolean;


  constructor(scope: Construct, id: string, props: WatchFirehoseServiceProps) {
    super(scope, id);

    this.watchful = props.watchful;
    this.fh = props.fh;
    this.autoResolveEvents = props.autoResolveEvents ?? false;

    this.watchful.addSection(props.title, {
      links: [{ title: 'Firehose Console', url: linkForFirehoseService(this.fh) }],
    });

    const {
      deliveryToRedshiftSuccessMetric, deliveryToRedshiftSuccessAlarm,
    } = this.createDeliveryToRedshiftSuccessMonitor();
    const {
      deliveryToRedshiftRecordsMetric,
    } = this.createDeliveryToRedshiftRecordsMonitor();

    // add all the widgets
    this.watchful.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Delivery to Redshift success',
        width: 12,
        left: [deliveryToRedshiftSuccessMetric],
        leftAnnotations: [deliveryToRedshiftSuccessAlarm.toAnnotation()],
      }),
      new cloudwatch.GraphWidget({
        title: 'Records delivered to Redshift (Sum)',
        width: 12,
        left: [deliveryToRedshiftRecordsMetric],
      }),
    );
  } // constructor

  // helper functions for creating metrics
  private createDeliveryToRedshiftSuccessMonitor() {
    var streamname = this.fh.deliveryStreamName;
    if (streamname == undefined) {
      streamname = '';
    }
    const deliveryToRedshiftSuccessMetric = new cloudwatch.Metric({
      metricName: FirehoseGatewayMetric.DeliveryToRedshiftSuccess,
      namespace: 'AWS/Firehose',
      period: Duration.minutes(1),
      statistic: 'sum',
      dimensionsMap: {
        DeliveryStreamName: streamname,
      },
    });
    const deliveryToRedshiftSuccessAlarm = new cloudwatch.Alarm(this, 'deliveryToRedshiftAlarm', {
      alarmName: `${this.fh.deliveryStreamName}-unsuccessful-delivery`,
      alarmDescription: `${this.fh.deliveryStreamName} delivery unsuccessful`,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      metric: deliveryToRedshiftSuccessMetric,
      threshold: 1,
      //period: Duration.minutes(1),
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    this.watchful.addAlarm(deliveryToRedshiftSuccessAlarm, this.autoResolveEvents);
    return { deliveryToRedshiftSuccessMetric, deliveryToRedshiftSuccessAlarm };
  }
  private createDeliveryToRedshiftRecordsMonitor() {
    var streamname = this.fh.deliveryStreamName;
    if (streamname == undefined) {
      streamname = '';
    }
    const deliveryToRedshiftRecordsMetric = new cloudwatch.Metric({
      metricName: FirehoseGatewayMetric.DeliveryToRedshiftRecords,
      namespace: 'AWS/Firehose',
      period: Duration.minutes(1),
      statistic: 'sum',
      dimensionsMap: {
        DeliveryStreamName: streamname,
      },
    });
    return { deliveryToRedshiftRecordsMetric };
  }
}

// TODO extend to monitor all the things
const enum FirehoseGatewayMetric {
  DeliveryToRedshiftSuccess = 'DeliveryToRedshift.Success',
  DeliveryToRedshiftRecords = 'DeliveryToRedshift.Records',
}

function linkForFirehoseService(fh: firehose.CfnDeliveryStream) {
  return `https://console.aws.amazon.com/firehose/home?region=${fh.stack.region}#/details/${fh.deliveryStreamName}`;
}
