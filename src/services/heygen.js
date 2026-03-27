const config = require('../config');

/**
 * Generate a video with HeyGen AI avatar
 * @param {object} options - Video generation options
 * @param {string} options.script - The text the avatar will speak
 * @param {string} options.avatar_id - HeyGen avatar ID (optional, uses default)
 * @param {string} options.voice_id - HeyGen voice ID (optional)
 * @param {string} options.title - Video title for reference
 * @returns {object} { video_id, status }
 */
async function generateVideo(options) {
  if (!config.heygenApiKey) {
    throw new Error('HEYGEN_API_KEY not configured');
  }

  const { script, avatar_id, voice_id, title } = options;

  console.log(`[HeyGen] Generating video: "${title || 'untitled'}", script length: ${script.length}`);

  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': config.heygenApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: avatar_id || 'default',
          avatar_style: 'normal'
        },
        voice: {
          type: 'text',
          input_text: script,
          voice_id: voice_id || null
        }
      }],
      dimension: { width: 1080, height: 1920 },
      title: title || 'MagnetCreative Video'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[HeyGen] Error: ${response.status} - ${err.substring(0, 300)}`);
    throw new Error(`HeyGen API error: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[HeyGen] Video queued: ${data.data?.video_id}`);
  return { video_id: data.data?.video_id, status: 'processing' };
}

/**
 * Check video generation status
 */
async function getVideoStatus(videoId) {
  if (!config.heygenApiKey) throw new Error('HEYGEN_API_KEY not configured');

  const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': config.heygenApiKey }
  });

  if (!response.ok) throw new Error(`HeyGen status error: ${response.status}`);
  const data = await response.json();
  return {
    status: data.data?.status, // 'processing', 'completed', 'failed'
    video_url: data.data?.video_url,
    thumbnail_url: data.data?.thumbnail_url,
    duration: data.data?.duration
  };
}

/**
 * List available avatars
 */
async function listAvatars() {
  if (!config.heygenApiKey) throw new Error('HEYGEN_API_KEY not configured');

  const response = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'X-Api-Key': config.heygenApiKey }
  });

  if (!response.ok) throw new Error(`HeyGen avatars error: ${response.status}`);
  const data = await response.json();
  return data.data?.avatars || [];
}

module.exports = { generateVideo, getVideoStatus, listAvatars };
