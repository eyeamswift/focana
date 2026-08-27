import type { APIRoute } from 'astro';

export const prerender = false;

const DOWNLOADS = {
  arm64: {
    fallbackUrl: 'https://github.com/eyeamswift/focana/releases/download/v1.6.1/Focana-1.6.1-mac-arm64.dmg',
    envUrl: import.meta.env.PUBLIC_GITHUB_ARM64_DMG_URL,
  },
  x64: {
    fallbackUrl: 'https://github.com/eyeamswift/focana/releases/download/v1.6.1/Focana-1.6.1-mac-x64.dmg',
    envUrl: import.meta.env.PUBLIC_GITHUB_X64_DMG_URL,
  },
} as const;

type DownloadArch = keyof typeof DOWNLOADS;

function normalizeArch(rawArch: string | null): DownloadArch | null {
  const arch = (rawArch || '').trim().toLowerCase();
  if (['arm64', 'arm', 'apple', 'apple_silicon', 'apple-silicon'].includes(arch)) {
    return 'arm64';
  }
  if (['x64', 'intel', 'amd64'].includes(arch)) {
    return 'x64';
  }
  return null;
}

function redirect(location: string, status = 302) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
    },
  });
}

async function resolveGitHubAssetUrl(downloadUrl: string) {
  try {
    const response = await fetch(downloadUrl, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'FocanaDownloadRedirect/1.0',
      },
    });

    const location = response.headers.get('location');
    if (location) {
      return new URL(location, downloadUrl).toString();
    }
  } catch (error) {
    console.error('[download] Failed to resolve GitHub release asset URL:', error);
  }

  return downloadUrl;
}

export const GET: APIRoute = async ({ url }) => {
  const arch = normalizeArch(url.searchParams.get('arch'));
  if (!arch) {
    return new Response(JSON.stringify({ error: 'Unsupported download architecture' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  const download = DOWNLOADS[arch];
  const downloadUrl = String(download.envUrl || download.fallbackUrl).trim();
  if (!downloadUrl) {
    return new Response(JSON.stringify({ error: 'Download is not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  return redirect(await resolveGitHubAssetUrl(downloadUrl));
};
