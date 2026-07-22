import { supabase } from './supabase';

async function getDriveToken() {
  const { data, error } = await supabase.functions.invoke('google-drive-token', { method: 'POST' });
  if (error) {
    let detail = error.message;
    try { detail = (await error.context.json())?.error || detail; } catch { /* keep default */ }
    throw new Error(detail);
  }
  return data; // { accessToken, expiresIn, folderId }
}

// Extracts the Drive file ID from either of the URL shapes we generate.
function extractDriveFileId(url) {
  const match = url?.match(/[?&]id=([^&]+)/) || url?.match(/\/file\/d\/([^/]+)/);
  return match?.[1] || null;
}

// The plain "uc?export=download" link shows an interstitial "can't scan for
// viruses" page instead of raw bytes for larger files, which silently
// breaks <audio> playback. Fetching via the authenticated Drive API with
// alt=media avoids that entirely, at the cost of loading the file into
// memory once per page view (fine for typical meeting-length recordings).
export async function getPlayableDriveAudioUrl(driveUrl) {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) return driveUrl; // not a Drive URL — return as-is

  const { accessToken } = await getDriveToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Failed to load audio from Google Drive.');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
// resumable upload protocol. The file bytes never pass through our own
// backend, so there's no Supabase (or edge function) size limit involved —
// Google's resumable upload supports files up to 5TB.
export async function uploadAudioToGoogleDrive(file, onProgress) {
  const { accessToken, folderId } = await getDriveToken();

  onProgress?.('Starting upload to Google Drive...');

  // Step 1: initiate a resumable upload session
  const initResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify({
        name: file.name,
        parents: folderId ? [folderId] : undefined,
      }),
    }
  );

  if (!initResponse.ok) {
    const errBody = await initResponse.text().catch(() => '');
    throw new Error(`Failed to start Google Drive upload: ${errBody || initResponse.statusText}`);
  }

  const uploadUrl = initResponse.headers.get('Location');
  if (!uploadUrl) throw new Error('Google Drive did not return an upload session URL.');

  // Step 2: upload the file bytes to the session URL
  onProgress?.('Uploading audio to Google Drive...');
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errBody = await uploadResponse.text().catch(() => '');
    throw new Error(`Google Drive upload failed: ${errBody || uploadResponse.statusText}`);
  }

  const driveFile = await uploadResponse.json(); // { id, ... }

  // Step 3: make the file link-viewable so it can be played back / downloaded
  await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }).catch(() => { /* non-fatal — file still exists, just not link-shared */ });

  onProgress?.('Upload complete.');

  return {
    fileId: driveFile.id,
    // Direct-download style link, playable in an <audio> tag for most files
    audioUrl: `https://drive.google.com/uc?export=download&id=${driveFile.id}`,
    viewUrl: `https://drive.google.com/file/d/${driveFile.id}/view`,
  };
}
