const { ConstructLibraryAws, Semver } = require('projen');

const project = new ConstructLibraryAws({
  name: '@myhelix/cdk-watchful',
  description: 'Forked from https://github.com/eladb/cdk-watchful',
  defaultReleaseBranch: 'main',

  authorName: 'Helix Devops',
  authorEmail: '',
  repository: 'https://github.com/myhelix/cdk-watchful.git',
  keywords: [
    'cloudwatch',
    'monitoring',
  ],

  // creates PRs for projen upgrades
  projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',

  cdkVersion: '1.75.0',
  cdkDependencies: [
    '@aws-cdk/aws-apigateway',
    '@aws-cdk/aws-cloudwatch',
    '@aws-cdk/aws-cloudwatch-actions',
    '@aws-cdk/aws-dynamodb',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-ecs-patterns',
    '@aws-cdk/aws-elasticloadbalancingv2',
    '@aws-cdk/aws-events',
    '@aws-cdk/aws-events-targets',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/aws-rds',
    '@aws-cdk/aws-sns',
    '@aws-cdk/aws-sns-subscriptions',
    '@aws-cdk/aws-sqs',
    '@aws-cdk/core',
  ],

  devDeps: [
    'aws-sdk',
  ],

});

// to support the Helix CircleCI Orb
project.setScript('lint', 'npx projen eslint');

project.gitignore.exclude('.env', '.idea');
project.gitignore.exclude('example/*.js', 'example/*.d.ts');

project.synth();
