import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Watchful } from '../src';

function alarmLogicalIds(stack: Stack): string[] {
  return Object.keys(Template.fromStack(stack).findResources('AWS::CloudWatch::Alarm'));
}

test('watchSqs defaults alarmId to deliveryToRedshiftAlarm for backwards compatibility', () => {
  const stack = new Stack();
  const wf = new Watchful(stack, 'watchful');
  const queue = new Queue(stack, 'Q');

  wf.watchSqs('my-queue', queue);

  const ids = alarmLogicalIds(stack);
  expect(ids.some(id => id.includes('deliveryToRedshiftAlarm'))).toBe(true);
});

test('watchSqs respects caller-supplied alarmId', () => {
  const stack = new Stack();
  const wf = new Watchful(stack, 'watchful');
  const queue = new Queue(stack, 'Q');

  wf.watchSqs('my-queue', queue, { alarmId: 'MyCustomDlqAlarm' });

  const ids = alarmLogicalIds(stack);
  expect(ids.some(id => id.includes('MyCustomDlqAlarm'))).toBe(true);
  expect(ids.some(id => id.includes('deliveryToRedshiftAlarm'))).toBe(false);
});
