const fs = require('fs');
const path = require('path');
const { awscdk, Component, DependencyType } = require('projen');

const cdkVersion = '1.161.0';

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
    '@aws-cdk/aws-kinesisfirehose',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/aws-rds',
    '@aws-cdk/aws-sns',
    '@aws-cdk/aws-sns-subscriptions',
    '@aws-cdk/aws-sqs',
    '@aws-cdk/aws-stepfunctions',
    '@aws-cdk/core',
  ],

  devDeps: ['aws-sdk', 'eslint-plugin-import'],
});

// projen pins jsii-diff below 1.131.0, which is vulnerable to CVE-2026-15895
project.deps.addDependency('jsii-diff@^1.131.0', DependencyType.BUILD);

// projen 0.58 hard-codes deprecated artifact actions, and GitHub rejects them.
// The dist artifact is a repo copy whose .projen/ dir must survive upload, which v4 only does with include-hidden-files.
class WorkflowPatches extends Component {
  postSynthesize() {
    for (const file of ['build.yml', 'release.yml', 'upgrade-main.yml']) {
      const filePath = path.join(this.project.outdir, '.github/workflows', file);
      if (!fs.existsSync(filePath)) continue;
      const content = fs
        .readFileSync(filePath, 'utf8')
        .replace(/actions\/upload-artifact@v2(\.1\.1)?/g, 'actions/upload-artifact@v4')
        .replace(/actions\/download-artifact@v3/g, 'actions/download-artifact@v4')
        .replace(
          /(uses: actions\/upload-artifact@v4\n\s+with:\n\s+name: build-artifact\n\s+path: dist)/g,
          '$1\n          include-hidden-files: true',
        )
        .replace(
          '      - name: Push changes\n        run:',
          '      - name: Push changes\n        env:\n          HEAD_REF: ${{ github.event.pull_request.head.ref }}\n        run:',
        )
        .replace('git push origin HEAD:${{ github.event.pull_request.head.ref }}', 'git push origin HEAD:"$HEAD_REF"');
      fs.chmodSync(filePath, 0o644);
      fs.writeFileSync(filePath, content);
    }
  }
}
new WorkflowPatches(project);

project.gitignore.exclude('.env', '.idea');
project.gitignore.exclude('example/*.js', 'example/*.d.ts');

project.synth();
