const { awscdk } = require('projen');

const cdkVersion = '2.29.0';

const project = new awscdk.AwsCdkConstructLibrary({
  name: '@myhelix/cdk-watchful',
  description: 'Watching your CDK apps since 2019',
  defaultReleaseBranch: 'main',

  authorName: 'Elad Ben-Israel (maintained by myhelix)',
  authorEmail: 'ops@helix.com',
  repository: 'https://github.com/myhelix/cdk-watchful.git',
  keywords: ['cloudwatch', 'monitoring'],

  // creates PRs for projen upgrades
  projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',

  cdkVersion,
  cdkVersionPinning: true,

  devDeps: ['aws-sdk', '@aws-cdk/assert'],
});

project.gitignore.exclude('.env', '.idea');
project.gitignore.exclude('example/*.js', 'example/*.d.ts');

project.synth();
