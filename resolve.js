// 抖音视频解析 API - 部署在 Vercel
// 路径: /api/resolve?url=你的链接

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const url = req.query.url
  if (!url) {
    return res.status(400).json({ error: '缺少url参数，用法: /api/resolve?url=https://v.douyin.com/xxx' })
  }

  // 从链接提取 video ID
  let videoId = null
  // 尝试直接从链接匹配数字视频ID
  const m1 = url.match(/video\/(\d+)/)
  if (m1) { videoId = m1[1] }

  if (!videoId) {
    // 短链接 v.douyin.com/xxx → 跟随重定向获取ID
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' },
        redirect: 'follow'
      })
      const m2 = resp.url.match(/video\/(\d+)/)
      if (m2) { videoId = m2[1] }
      if (!videoId) {
        const html = await resp.text()
        const m3 = html.match(/video\/(\d+)/)
        if (m3) videoId = m3[1]
      }
    } catch (e) {
      return res.status(500).json({ error: '链接请求失败', detail: e.message })
    }
  }

  if (!videoId) {
    return res.status(400).json({ error: '无法提取视频ID' })
  }

  // 请求抖音官方 API
  try {
    const apiResp = await fetch(
      `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${videoId}&aid=1128`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S9080) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.douyin.com/',
          'Cookie': 'ttwid=1%7C' + Date.now().toString(16) + ';'
        }
      }
    )

    const data = await apiResp.json()

    let videoUrl = null
    if (data.aweme_detail?.video?.play_addr?.url_list?.[0]) {
      videoUrl = data.aweme_detail.video.play_addr.url_list[0]
    } else if (data.aweme_detail?.video?.play_addr_lowbr?.url_list?.[0]) {
      videoUrl = data.aweme_detail.video.play_addr_lowbr.url_list[0]
    }

    if (!videoUrl) {
      return res.status(404).json({
        error: 'API没有返回视频地址',
        hasDetail: !!data.aweme_detail,
        statusCode: data.status_code,
        statusMsg: data.status_msg
      })
    }

    videoUrl = videoUrl.replace(/\\u002F/g, '/').replace(/\\\//g, '/')

    res.json({ videoUrl, videoId })
  } catch (e) {
    res.status(500).json({ error: 'API请求失败', detail: e.message })
  }
}
