import * as cdk from '@aws-cdk/core';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import { IWatchful } from './api';
import { Metric } from '@aws-cdk/aws-cloudwatch';
import { Duration } from '@aws-cdk/core';

export interface WatchFirehoseServiceOptions {
}

export interface WatchFirehoseServiceProps extends WatchFirehoseServiceOptions {
  readonly title: string;
  readonly watchful: IWatchful;
  readonly firehose: firehose.CfnDeliveryStream;
}

export class WatchFirehoseService extends cdk.Construct {
  private readonly watchful: IWatchful;
  private readonly firehose: firehose.CfnDeliveryStream;

  constructor(scope: cdk.Construct, id: string, props: WatchFirehoseServiceProps) {
    super(scope, id);

    this.watchful = props.watchful;
    this.firehose = props.firehose;

    this.watchful.addSection(props.title, {
      links: [{ title: 'Firehose Console', url: linkForFirehoseService(this.firehose) }],
    });

    const {
      deliveryToRedshiftSuccessMetric,
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
    const deliveryToRedshiftSuccessMetric = new Metric({
      metricName: FirehoseGatewayMetric.DeliveryToRedshiftSuccess,
      namespace: 'AWS/Firehose',
      period: Duration.minutes(1),
      statistic: 'sum',
    });

    return { deliveryToRedshiftSuccessMetric };
  }
  private createDeliveryToRedshiftRecordsMonitor() {
    const deliveryToRedshiftRecordsMetric = new Metric({
      metricName: FirehoseGatewayMetric.DeliveryToRedshiftRecords,
      namespace: 'AWS/Firehose',
      period: Duration.minutes(1),
      statistic: 'sum',
    });
    return { deliveryToRedshiftRecordsMetric };
  }
}

// TODO extend to monitor all the things
const enum FirehoseGatewayMetric {
  DeliveryToRedshiftSuccess = 'DeliveryToRedshift.Success',
  DeliveryToRedshiftRecords = 'DeliveryToRedshift.Records',
}

function linkForFirehoseService(firehose: firehose.CfnDeliveryStream) {
  return `https://console.aws.amazon.com/firehose/home?region=${firehose.stack.region}#/details/${firehose.deliveryStreamName}`;
}
