'use strict';
(() => {
  const config = window.SEEK_SITE || {};
  document.querySelectorAll('[data-version]').forEach(el => { el.textContent = config.version || '0.4.0'; });
  function safeUrl(value) {
    if (!value || typeof value !== 'string') return null;
    try { const url = new URL(value, location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  if (safeUrl(config.toolsUrl)) {
    const link = document.createElement('a'); link.textContent = 'Tools'; link.href = safeUrl(config.toolsUrl);
    document.getElementById('tools-home').replaceChildren(link);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const base = config.releaseBaseUrl ? safeUrl(config.releaseBaseUrl.replace(/\/+$/, '') + '/') : local ? new URL('downloads/', location.href).href : null;
  for (const platform of ['mac', 'mac-intel', 'windows']) {
    const link = document.getElementById('download-' + platform);
    const filename = config.files?.[platform];
    if (base && filename && /^[A-Za-z0-9._-]+$/.test(filename)) {
      link.href = new URL(filename, base).href;
      link.setAttribute('download', filename);
    } else {
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('role', 'link');
      link.setAttribute('tabindex', '0');
      link.addEventListener('click', e => e.preventDefault());
    }
  }
  if (!base) {
    const message = document.getElementById('download-availability');
    message.textContent = 'Public downloads will be available when the release is published.';
    message.hidden = false;
  }
  const formatSize = bytes => bytes >= 1024**3 ? (bytes/1024**3).toFixed(1)+' GB' : Math.round(bytes/1024**2)+' MB';
  document.querySelectorAll('[data-file-size]').forEach(el => { const size=config.sizes?.[el.dataset.fileSize]; if(size)el.textContent=formatSize(size); });
  if (base && Array.isArray(config.windowsFiles) && config.windowsFiles.length > 1) {
    const trigger=document.getElementById('download-windows'),dialog=document.getElementById('windows-download-dialog');
    trigger.setAttribute('role','button');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','windows-download-dialog');
    document.getElementById('windows-file-format').textContent=config.windowsFiles.length+' files';
    const list=document.getElementById('windows-installer-files');
    for(const file of config.windowsFiles){
      if(!/^[A-Za-z0-9._-]+$/.test(file.filename))continue;
      const link=document.createElement('a');link.href=new URL(file.filename,base).href;link.download=file.filename;
      const name=document.createElement('span');name.textContent=file.filename;
      const size=document.createElement('small');size.textContent=formatSize(file.size_bytes)+' ↓';
      link.append(name,size);list.append(link);
    }
    trigger.addEventListener('click',e=>{e.preventDefault();dialog.showModal();});
    trigger.addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();dialog.showModal();}});
    document.getElementById('close-windows-download').onclick=()=>dialog.close();
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  }
  const videoUrl = safeUrl(config.demoVideoUrl);
  if (videoUrl) {
    const video = document.createElement('video');
    video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.src = videoUrl;
    const posterUrl = safeUrl(config.demoPosterUrl);
    if (posterUrl) video.poster = posterUrl;
    video.setAttribute('aria-label', 'SEEK demonstration video');
    document.getElementById('demo-media').replaceChildren(video);
  }
})();
