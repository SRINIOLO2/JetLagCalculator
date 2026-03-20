/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS || false;

let basePath = '';

if (isGithubActions && process.env.GITHUB_REPOSITORY) {
  const repo = process.env.GITHUB_REPOSITORY.replace(/.*?\//, '');
  basePath = `/${repo}`;
}

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: basePath,
};

export default nextConfig;
