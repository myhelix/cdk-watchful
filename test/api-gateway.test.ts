import { expect as cdk_expect, haveResource, haveResourceLike } from '@aws-cdk/assert';
import { Duration, Stack } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Watchful } from '../src';

function apiStack(): { stack: Stack; api: apigw.RestApi; watchful: Watchful } {
  const stack = new Stack();
  const api = new apigw.RestApi(stack, 'api');
  api.root.addMethod('GET');
  const watchful = new Watchful(stack, 'watchful');
  return { stack, api, watchful };
}

test('default alarm alarms on a single breaching period, as before', () => {
  // GIVEN
  const { stack, api, watchful } = apiStack();

  // WHEN
  watchful.watchApiGateway('api', api, { serverErrorThreshold: 5 });

  // THEN
  cdk_expect(stack).to(haveResourceLike('AWS::CloudWatch::Alarm', {
    MetricName: '5XXError',
    Threshold: 5,
    EvaluationPeriods: 1,
    Period: 300,
    AlarmDescription: 'at 5',
  }));
});

test('sustained-breach options configure a rolling multi-period window', () => {
  // GIVEN
  const { stack, api, watchful } = apiStack();

  // WHEN
  watchful.watchApiGateway('api', api, {
    serverErrorThreshold: 5,
    alarmPeriod: Duration.minutes(1),
    alarmEvaluationPeriods: 5,
    alarmDatapointsToAlarm: 3,
    alarmTreatMissingData: TreatMissingData.NOT_BREACHING,
    alarmDescription: 'Sustained 5XX errors: >=5/min in 3 of the last 5 minutes.',
  });

  // THEN
  cdk_expect(stack).to(haveResourceLike('AWS::CloudWatch::Alarm', {
    MetricName: '5XXError',
    Threshold: 5,
    Period: 60,
    EvaluationPeriods: 5,
    DatapointsToAlarm: 3,
    TreatMissingData: 'notBreaching',
    AlarmDescription: 'Sustained 5XX errors: >=5/min in 3 of the last 5 minutes.',
  }));
});

test('disableAlerts skips the alarm entirely, regardless of the new options', () => {
  // GIVEN
  const { stack, api, watchful } = apiStack();

  // WHEN
  watchful.watchApiGateway('api', api, {
    disableAlerts: true,
    alarmEvaluationPeriods: 5,
    alarmDatapointsToAlarm: 3,
  });

  // THEN
  cdk_expect(stack).notTo(haveResource('AWS::CloudWatch::Alarm'));
});
