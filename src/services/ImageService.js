import sharp from 'sharp';
import fetch from 'node-fetch';
import crypto from 'crypto';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
  secureProtocol: 'TLSv1_2_method'
});

function getR2Endpoint() {
  return `https://${getBucketName()}.${
    process.env.CLOUDFLARE_ACCOUNT_ID
  }.r2.cloudflarestorage.com`;
}

function getBucketName() {
  return process.env.R2_BUCKET_NAME || 'baphomet-images';
}

const IMAGE_CONFIGS = {
  poster: {
    sizes: [
      { name: 'w500', width: 500 },
      { name: 'w780', width: 780 }
    ],
    aspectRatio: 2 / 3,
    defaultSize: 'w500'
  },
  profile: {
    sizes: [
      { name: 'w185', width: 185 },
      { name: 'h632', height: 632 }
    ],
    aspectRatio: 2 / 3,
    defaultSize: 'w185'
  },
  backdrop: {
    sizes: [
      { name: 'w780', width: 780 },
      { name: 'w1920', width: 1920 }
    ],
    aspectRatio: 16 / 9,
    defaultSize: 'w780'
  }
};

class ImageService {
  createAuthHeader(
    method,
    path,
    contentType = '',
    dateString = new Date().toUTCString(),
    extraHeaders = {}
  ) {
    const region = 'auto';
    const service = 's3';
    const algorithm = 'AWS4-HMAC-SHA256';

    const date = new Date(dateString);
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substr(0, 8);

    const host = `${getBucketName()}.${
      process.env.CLOUDFLARE_ACCOUNT_ID
    }.r2.cloudflarestorage.com`;

    const canonicalUri = path;
    const canonicalQueryString = '';
    const payloadHash = 'UNSIGNED-PAYLOAD';
    const headerMap = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...extraHeaders
    };
    if (contentType) headerMap['content-type'] = contentType;

    const signedHeaderNames = Object.keys(headerMap).sort();
    const canonicalHeaders = signedHeaderNames
      .map(name => `${name}:${headerMap[name]}\n`)
      .join('');
    const signedHeaders = signedHeaderNames.join(';');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const kDate = crypto
      .createHmac('sha256', `AWS4${process.env.R2_SECRET_ACCESS_KEY}`)
      .update(dateStamp)
      .digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto
      .createHmac('sha256', kRegion)
      .update(service)
      .digest();
    const kSigning = crypto
      .createHmac('sha256', kService)
      .update('aws4_request')
      .digest();
    const signature = crypto
      .createHmac('sha256', kSigning)
      .update(stringToSign)
      .digest('hex');

    return {
      authorization: `${algorithm} Credential=${process.env.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      amzDate
    };
  }

  generateR2Key(type, ownerId, size, extension = 'jpg') {
    const collection = type === 'profile' ? 'people' : 'movies';
    return `images/${collection}/${ownerId}/${type}/${size}.${extension}`;
  }

  async copyObject(sourceKey, destKey) {
    const copySource = `/${getBucketName()}/${sourceKey
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const date = new Date().toUTCString();
    const { authorization, amzDate } = this.createAuthHeader(
      'PUT',
      `/${destKey}`,
      '',
      date,
      { 'x-amz-copy-source': copySource }
    );

    const response = await fetch(`${getR2Endpoint()}/${destKey}`, {
      method: 'PUT',
      agent: httpsAgent,
      headers: {
        'x-amz-copy-source': copySource,
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        'x-amz-date': amzDate,
        Authorization: authorization
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Copy failed: ${response.status} ${response.statusText} ${body}`
      );
    }
  }

  async deleteObject(key) {
    const date = new Date().toUTCString();
    const { authorization, amzDate } = this.createAuthHeader(
      'DELETE',
      `/${key}`,
      '',
      date
    );

    const response = await fetch(`${getR2Endpoint()}/${key}`, {
      method: 'DELETE',
      agent: httpsAgent,
      headers: {
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        'x-amz-date': amzDate,
        Authorization: authorization
      }
    });

    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new Error(
        `Delete failed: ${response.status} ${response.statusText} ${body}`
      );
    }
  }

  async imageExists(key) {
    try {
      const date = new Date().toUTCString();
      const { authorization, amzDate } = this.createAuthHeader(
        'HEAD',
        `/${key}`,
        '',
        date
      );

      const response = await fetch(`${getR2Endpoint()}/${key}`, {
        method: 'HEAD',
        agent: httpsAgent,
        headers: {
          'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
          'x-amz-date': amzDate,
          Authorization: authorization
        }
      });

      return response.status === 200;
    } catch (error) {
      console.error('Error checking image existence:', error);
      return false;
    }
  }

  async downloadImage(tmdbUrl) {
    const response = await fetch(tmdbUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async resizeImage(buffer, config, size) {
    const sharp_image = sharp(buffer);

    if (size.name === 'original') {
      return buffer;
    }

    let resized;
    if (size.width && size.height) {
      resized = sharp_image.resize(size.width, size.height, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true
      });
    } else if (size.width) {
      const height = Math.round(size.width / config.aspectRatio);
      resized = sharp_image.resize(size.width, height, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true
      });
    } else if (size.height) {
      const width = Math.round(size.height * config.aspectRatio);
      resized = sharp_image.resize(width, size.height, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: true
      });
    }

    return resized.jpeg({ quality: 85, progressive: true }).toBuffer();
  }

  async uploadToR2(key, buffer, contentType = 'image/jpeg') {
    try {
      const date = new Date().toUTCString();
      const { authorization, amzDate } = this.createAuthHeader(
        'PUT',
        `/${key}`,
        contentType,
        date
      );

      const response = await fetch(`${getR2Endpoint()}/${key}`, {
        method: 'PUT',
        agent: httpsAgent,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-amz-meta-source': 'tmdb',
          'x-amz-meta-processed-at': new Date().toISOString(),
          'x-amz-storage-class': 'STANDARD', // Use Class B operations for cost savings
          'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
          'x-amz-date': amzDate,
          Authorization: authorization
        },
        body: buffer
      });

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}`
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  async getImageUrl(key, expiresIn = 604800) {
    if (process.env.R2_CUSTOM_DOMAIN) {
      return `${process.env.R2_CUSTOM_DOMAIN}/${key}`;
    }

    const region = 'auto';
    const service = 's3';
    const algorithm = 'AWS4-HMAC-SHA256';

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substr(0, 8);

    const url = new URL(`${getR2Endpoint()}/${key}`);
    const host = url.host;

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const queryParams = {
      'X-Amz-Algorithm': algorithm,
      'X-Amz-Credential': `${process.env.R2_ACCESS_KEY_ID}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresIn.toString(),
      'X-Amz-SignedHeaders': 'host'
    };

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map(
        key =>
          `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`
      )
      .join('&');

    const canonicalRequest = [
      'GET',
      `/${key}`,
      canonicalQueryString,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD'
    ].join('\n');

    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const kDate = crypto
      .createHmac('sha256', `AWS4${process.env.R2_SECRET_ACCESS_KEY}`)
      .update(dateStamp)
      .digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto
      .createHmac('sha256', kRegion)
      .update(service)
      .digest();
    const kSigning = crypto
      .createHmac('sha256', kService)
      .update('aws4_request')
      .digest();
    const signature = crypto
      .createHmac('sha256', kSigning)
      .update(stringToSign)
      .digest('hex');

    return `${getR2Endpoint()}/${key}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  async processImage(tmdbUrl, type, ownerId) {
    const imageType = String(type).toLowerCase();
    const config = IMAGE_CONFIGS[imageType];
    if (!config) {
      throw new Error(`Invalid image type: ${type}`);
    }
    if (ownerId === undefined || ownerId === null || ownerId === '') {
      throw new Error(`ownerId is required to store ${imageType} images`);
    }

    const owner = String(ownerId);
    const originalBuffer = await this.downloadImage(tmdbUrl);

    const results = {};

    for (const size of config.sizes) {
      const key = this.generateR2Key(imageType, owner, size.name);

      if (await this.imageExists(key)) {
        results[size.name] = await this.getImageUrl(key);
        continue;
      }

      try {
        const resizedBuffer = await this.resizeImage(
          originalBuffer,
          config,
          size
        );
        await this.uploadToR2(key, resizedBuffer);
        results[size.name] = await this.getImageUrl(key);

        console.log(`✅ Processed ${imageType} ${size.name}: ${key}`);
      } catch (error) {
        console.error(`❌ Failed to process ${imageType} ${size.name}:`, error);
        throw error;
      }
    }

    return results;
  }

  async getImage(tmdbUrl, type, requestedSize = null, ownerId) {
    const imageType = String(type).toLowerCase();
    const config = IMAGE_CONFIGS[imageType];
    const size = requestedSize || config.defaultSize;
    const key = this.generateR2Key(imageType, ownerId, size);

    if (await this.imageExists(key)) {
      return await this.getImageUrl(key);
    }

    const results = await this.processImage(tmdbUrl, imageType, ownerId);
    return results[size];
  }

  async batchProcessImages(images) {
    const results = {};

    for (const { tmdbUrl, type, id, ownerId } of images) {
      try {
        const variants = await this.processImage(
          tmdbUrl,
          type,
          ownerId ?? id
        );
        results[id] = variants;
      } catch (error) {
        console.error(`Failed to process image ${id}:`, error);
        results[id] = { error: error.message };
      }
    }

    return results;
  }
}

export default new ImageService();
