import axios from 'axios'
import * as cheerio from 'cheerio'

/**
 * TikTok engagement data structure
 */
export interface TikTokEngagement {
  views: number | null
  likes: number | null
  comments: number | null
}

/**
 * TikTok engagement tracker - extracts views, likes, and comments from TikTok videos
 * 
 * @param url The TikTok video URL
 * @returns Object containing views, likes, and comments or null values if tracking failed
 */
export async function tiktokTracker(url: string): Promise<TikTokEngagement> {
  try {
    console.log(`Tracking TikTok engagement for: ${url}`)
    
    // Check if this is a shortened URL
    if (url.includes('/t/')) {
      console.log('Detected shortened TikTok URL, resolving...')
      const resolvedUrl = await resolveShortUrl(url)
      if (resolvedUrl) {
        console.log(`Resolved to: ${resolvedUrl}`)
        url = resolvedUrl
      } else {
        console.error('Failed to resolve shortened TikTok URL')
        return { views: null, likes: null, comments: null }
      }
    }
    
    // Extract video ID from URL
    const videoId = extractTikTokVideoId(url)
    if (!videoId) {
      console.error('Could not extract TikTok video ID from URL:', url)
      return { views: null, likes: null, comments: null }
    }
    
    console.log(`Extracted video ID: ${videoId}`)
    
    // Use similar headers to the successful Python implementation
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.tiktok.com/'
    }
    
    const response = await axios.get(url, { headers })
    
    if (response.status !== 200) {
      console.error(`Failed to fetch TikTok page: HTTP ${response.status}`)
      return { views: null, likes: null, comments: null }
    }
    
    // Use Cheerio to parse the HTML
    const $ = cheerio.load(response.data)
    
    let views: number | null = null
    let likes: number | null = null
    let comments: number | null = null
    
    // Method 1: Look for engagement data in embedded JSON data (prioritize this method)
    console.log('Trying to extract engagement data from embedded JSON')
    const scriptTags = $('script')
    
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html()
      if (scriptContent && scriptContent.includes('"stats":')) {
        // Try to extract all engagement metrics from JSON
        const viewCountMatch = scriptContent.match(/"playCount":(\d+)/)
        const likeCountMatch = scriptContent.match(/"diggCount":(\d+)/)
        const commentCountMatch = scriptContent.match(/"commentCount":(\d+)/)
        
        if (viewCountMatch) {
          views = parseInt(viewCountMatch[1], 10)
          console.log(`Found views in JSON: ${views}`)
        }
        
        if (likeCountMatch) {
          likes = parseInt(likeCountMatch[1], 10)
          console.log(`Found likes in JSON: ${likes}`)
        }
        
        if (commentCountMatch) {
          comments = parseInt(commentCountMatch[1], 10)
          console.log(`Found comments in JSON: ${comments}`)
        }
        
        // If we found some data, break out of the loop
        if (views !== null || likes !== null || comments !== null) {
          break
        }
      }
    }
    
    // Method 2: Try SIGI_STATE JSON data (newer TikTok format)
    if ((views === null && likes === null && comments === null)) {
      console.log('Trying to extract engagement data from SIGI_STATE')
    for (let i = 0; i < scriptTags.length; i++) {
      const scriptContent = $(scriptTags[i]).html()
      if (scriptContent && scriptContent.includes('SIGI_STATE')) {
        const jsonDataMatch = scriptContent.match(/window\['SIGI_STATE'\]=([\s\S]*?);<\/script>/)
        if (jsonDataMatch) {
          try {
            const jsonData = JSON.parse(jsonDataMatch[1])
              // Navigate through the JSON to find the engagement data
            if (jsonData.ItemModule && jsonData.ItemModule[videoId]) {
              const item = jsonData.ItemModule[videoId]
                if (item.stats) {
                  views = item.stats.playCount ? parseInt(item.stats.playCount, 10) : null
                  likes = item.stats.diggCount ? parseInt(item.stats.diggCount, 10) : null
                  comments = item.stats.commentCount ? parseInt(item.stats.commentCount, 10) : null
                  
                  console.log(`Found engagement data in SIGI_STATE:`, { views, likes, comments })
                  break
              }
            }
          } catch (e) {
              console.error(`Error parsing SIGI_STATE JSON data: ${e}`)
          }
        }
      }
    }
    }
    
    // Method 3: Look for engagement data in CSS selectors (fallback)
    if (views === null && likes === null && comments === null) {
      console.log('Trying to extract engagement data from CSS selectors')
      
      // Try to find view count
      const viewElements = $('[data-e2e="video-stat-count"]')
      if (viewElements.length > 0) {
        const viewCountText = $(viewElements[0]).text().trim()
        views = parseEngagementCount(viewCountText)
        console.log(`Found views in CSS: ${views}`)
      }
      
      // Try to find like and comment counts from other selectors
      $('[data-e2e]').each((_, element) => {
        const $element = $(element)
        const dataE2e = $element.attr('data-e2e')
        const text = $element.text().trim()
        
        if (dataE2e?.includes('like') && likes === null) {
          likes = parseEngagementCount(text)
          console.log(`Found likes in CSS: ${likes}`)
        }
        
        if (dataE2e?.includes('comment') && comments === null) {
          comments = parseEngagementCount(text)
          console.log(`Found comments in CSS: ${comments}`)
        }
      })
    }
    
    // Validate results
    if (views && isNaN(views)) views = null
    if (likes && isNaN(likes)) likes = null
    if (comments && isNaN(comments)) comments = null
    
    console.log(`TikTok video ${videoId} engagement:`, {
      views,
      likes,
      comments
    })
    
    return {
      views,
      likes,
      comments
    }
    
  } catch (error) {
    console.error('Error tracking TikTok engagement:', error)
    return { views: null, likes: null, comments: null }
  }
}

/**
 * Resolve a shortened TikTok URL to its full form
 */
async function resolveShortUrl(shortUrl: string): Promise<string | null> {
  try {
    // Use axios to follow redirects
    const response = await axios.get(shortUrl, {
      maxRedirects: 5,
      validateStatus: null,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    })
    
    // If we got redirected, the final URL will be in response.request.res.responseUrl
    // Note: This is a non-standard property that might not be available in all axios versions
    const finalUrl = response.request?.res?.responseUrl || 
                     response.request?.responseURL || 
                     response.headers?.location
    
    if (finalUrl) {
      return finalUrl
    }
    
    // If we can't get the final URL directly, try parsing from the page
    if (response.status === 200 && response.data) {
      const $ = cheerio.load(response.data)
      
      // Look for canonical link
      const canonicalLink = $('link[rel="canonical"]').attr('href')
      if (canonicalLink && canonicalLink.includes('tiktok.com')) {
        return canonicalLink
      }
      
      // Look for og:url meta tag
      const ogUrl = $('meta[property="og:url"]').attr('content')
      if (ogUrl && ogUrl.includes('tiktok.com')) {
        return ogUrl
      }
    }
    
    return null
  } catch (error) {
    console.error('Error resolving shortened URL:', error)
    return null
  }
}

/**
 * Extract the TikTok video ID from a URL
 */
function extractTikTokVideoId(url: string): string | null {
  try {
    // Check for various URL patterns
    
    // Standard pattern: /video/{id}
    const videoIdRegex = /\/video\/(\d+)/
    const match = url.match(videoIdRegex)
    
    if (match && match[1]) {
      return match[1]
    }
    
    // Alternative pattern for embedded videos: /embed/v2/(\d+)
    const embedRegex = /\/embed\/v2\/(\d+)/
    const embedMatch = url.match(embedRegex)
    
    if (embedMatch && embedMatch[1]) {
      return embedMatch[1]
    }
    
    // Some URLs have the ID in a query parameter
    const urlObj = new URL(url)
    const idParam = urlObj.searchParams.get('id')
    if (idParam) {
      return idParam
    }
    
    return null
  } catch (error) {
    console.error('Error extracting TikTok video ID:', error)
    return null
  }
}

/**
 * Parse an engagement count string (e.g., "1.2M", "450.3K") into a number
 */
function parseEngagementCount(countText: string): number | null {
  try {
    // Remove any non-numeric characters except for decimal points, K, M, B
    const cleaned = countText.replace(/[^0-9\.KMB]/gi, '')
    
    if (!cleaned) return null
    
    // Check if we have K, M, or B suffix
    let multiplier = 1
    let numberPart = cleaned
    
    if (cleaned.endsWith('K')) {
      multiplier = 1000
      numberPart = cleaned.slice(0, -1)
    } else if (cleaned.endsWith('M')) {
      multiplier = 1000000
      numberPart = cleaned.slice(0, -1)
    } else if (cleaned.endsWith('B')) {
      multiplier = 1000000000
      numberPart = cleaned.slice(0, -1)
    }
    
    // Parse the number and apply the multiplier
    const value = parseFloat(numberPart) * multiplier
    
    // Return the rounded integer value
    return Math.round(value)
  } catch (error) {
    console.error('Error parsing engagement count:', error)
    return null
  }
} 