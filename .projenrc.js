const { awscdk } = require('projen');

const cdkVersion = '2.29.0';

const project = new awscdk.AwsCdkConstructLibrary({
  name: '@myhelix/cdk-watchful',
  description: 'Watching your CDK apps since 2019',
  defaultReleaseBranch: 'release-v2',

  authorName: 'Elad Ben-Israel (maintained by myhelix)',
  authorEmail: 'ops@helix.com',
  repository: 'https://github.com/myhelix/cdk-watchful.git',
  keywords: ['cloudwatch', 'monitoring'],

  // creates PRs for projen upgrades
  projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',

  cdkVersion,
  cdkVersionPinning: true,

  // Anchor release line to v2.x. The bump task filters tags by "v2.*" and
  // refuses to publish a non-v2 version. v2.29.0 was pre-tagged on this
  // branch so standard-version minor-bumps to v2.30.0 on the next release.
  majorVersion: 2,

  devDeps: ['aws-sdk', '@aws-cdk/assert'],
});

project.gitignore.exclude('.env', '.idea');
project.gitignore.exclude('example/*.js', 'example/*.d.ts');

project.synth();

// Post-synth: bump deprecated GitHub Actions versions in projen-generated workflows.
// projen 0.55.6 emits actions/upload-artifact@v2 and actions/download-artifact@v2,
// which GitHub Actions has deprecated and now fails at the infra level. Upgrading
// projen itself is a larger change — this rewrite keeps the pin intact.
const fs = require('fs');
const path = require('path');
const workflowsDir = '.github/workflows';
if (fs.existsSync(workflowsDir)) {
  for (const file of fs.readdirSync(workflowsDir)) {
    const p = path.join(workflowsDir, file);
    let content = fs.readFileSync(p, 'utf8');
    let bumped = content
      .replace(/actions\/upload-artifact@v2(?:\.\d+){0,2}/g, 'actions/upload-artifact@v4')
      .replace(/actions\/download-artifact@v2(?:\.\d+){0,2}/g, 'actions/download-artifact@v4');
    // upload-artifact@v4 excludes hidden files by default, but projen keeps
    // task definitions in `.projen/` so we need them in the artifact.
    bumped = bumped.replace(
      /( {8}uses: actions\/upload-artifact@v4\n {8}with:\n(?: {10}[^\n]+\n)+)/g,
      (match) => match.includes('include-hidden-files') ? match : match + '          include-hidden-files: true\n',
    );
    if (bumped !== content) {
      fs.chmodSync(p, 0o644);
      fs.writeFileSync(p, bumped);
      fs.chmodSync(p, 0o444);
    }
  }
}
