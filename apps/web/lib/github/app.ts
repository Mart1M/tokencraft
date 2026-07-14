import { createPrivateKey } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

interface GitHubInstallationResponse {
  id: number;
  account: {
    login: string;
    type: "User" | "Organization";
  } | null;
}

function normalizePrivateKey(rawKey: string) {
  const pem = rawKey.replace(/\\n/g, "\n");

  // GitHub Apps issue PKCS#1 keys ("BEGIN RSA PRIVATE KEY") by default, but
  // jose's importPKCS8 only accepts PKCS#8 ("BEGIN PRIVATE KEY"). Node's
  // crypto module reads both, so re-export as PKCS#8 when needed.
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    return createPrivateKey(pem).export({ format: "pem", type: "pkcs8" }) as string;
  }

  return pem;
}

export async function createGitHubAppJwt({
  appId,
  privateKey
}: {
  appId: string;
  privateKey: string;
}) {
  const key = await importPKCS8(normalizePrivateKey(privateKey), "RS256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(appId)
    .sign(key);
}

export async function createInstallationAccessToken(installationId: string | number) {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials are required.");
  }

  const jwt = await createGitHubAppJwt({
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY
  });

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub installation token request failed with ${response.status}.`);
  }

  return (await response.json()) as InstallationTokenResponse;
}

export async function getGitHubAppInstallation(installationId: string | number) {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials are required.");
  }

  const jwt = await createGitHubAppJwt({
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY
  });

  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`GitHub installation request failed with ${response.status}.`);
  }

  return (await response.json()) as GitHubInstallationResponse;
}
