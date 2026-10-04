<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#f4f0ff" />
  <title>Nossas Músicas</title>
  <link rel="icon" href="icon.png" type="image/png" />
  <style>
    :root {
      --bg:#f4f0ff;
      --bg-2:#eee8ff;
      --surface:rgba(255,255,255,.92);
      --surface-solid:#fff;
      --primary:#9b5de5;
      --primary-strong:#8750cf;
      --primary-pale:#f4edff;
      --text:#29252f;
      --muted:#817b89;
      --line:rgba(102,82,126,.12);
      --shadow-sm:0 5px 18px rgba(80,56,115,.07);
      --shadow-md:0 16px 38px rgba(80,56,115,.11);
      --shadow-lg:0 28px 80px rgba(65,45,94,.18);
      --radius-lg:28px;
      --radius-md:20px;
      --radius-sm:16px;
    }

    * {margin:0;padding:0;box-sizing:border-box;}
    html {min-height:100%;scroll-behavior:smooth;}
    body {
      min-height:100vh; min-height:100dvh; overflow-x:hidden; color:var(--text);
      font-family: Inter, ui-sans-serif, sans-serif;
      background: radial-gradient(circle at 10% -8%, rgba(177,131,255,.22), transparent 31%), radial-gradient(circle at 94% 8%, rgba(220,204,255,.48), transparent 28%), linear-gradient(135deg, var(--bg), var(--bg-2));
      padding: max(18px, env(safe-area-inset-top)) 14px max(30px, env(safe-area-inset-bottom)) 14px;
    }
    body::before {
      content:""; position:fixed; inset:0; pointer-events:none; z-index:-1; opacity:.34; background-image: linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px); background-size:38px 38px; mask-image:linear-gradient(to bottom, black, transparent 76%);
    }
    button, a { font: inherit; }

    .app-shell { width:min(100%, 780px); margin:0 auto; }
    .topbar { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
    .navigation-button, .icon-button {
      display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:46px; border:1px solid var(--line); border-radius:16px; background:rgba(255,255,255,.78); color:var(--primary-strong); box-shadow:var(--shadow-sm); text-decoration:none; transition:transform .18s ease, box-shadow .18s ease, background .18s ease;
    }

    .navigation-button { padding:7px 10px; }
    .icon-button { width:46px; height:46px; }
    .navigation-button:hover, .icon-button:hover { transform:translateY(-2px); background:#fff; box-shadow:var(--shadow-md); }
    .navigation-button svg, .icon-button svg { width:21px; height:21px; }
    .navigation-label { max-width:70px; overflow:hidden; white-space:nowrap; font-size:11px; font-weight:800; }

    .container { width:100%; padding:clamp(20px,5vw,34px); border:1px solid rgba(120,92,155,.10); border-radius:var(--radius-lg); background:var(--surface); box-shadow:var(--shadow-lg); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); }
    .eyebrow { text-align:center; color:var(--primary-strong); font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; margin-bottom:7px; }
    h1 { text-align:center; font-size:clamp(34px,7vw,48px); line-height:1.05; font-weight:400; letter-spacing:-.025em; color:var(--text); }
    .subtitulo { margin:9px auto 0; max-width:58ch; text-align:center; font-size:16px; line-height:1.55; color:#776f7e; }

    .overview { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:stretch; gap:10px; margin-top:24px; }
    .overview-card { min-width:0; padding:17px; border:1px solid var(--line); border-radius:20px; background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(248,245,255,.88)); box-shadow:var(--shadow-sm); }
    .overview-label { color:var(--muted); font-size:11px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
    .lista-titulo { margin-top:3px; font-size:24px; line-height:1.1; }
    .collection-note { margin-top:5px; color:var(--muted); font-size:12px; }
    .contador { align-self:center; padding:10px 13px; border:1px solid var(--line); border-radius:14px; background:var(--primary-pale); color:var(--primary-strong); font-size:12px; font-weight:850; white-space:nowrap; }

    .status { display:flex; align-items:center; justify-content:center; gap:8px; min-height:22px; margin:18px 0 10px; color:var(--muted); font-size:12px; font-weight:700; text-align:center; }
    .status-dot { width:7px; height:7px; border-radius:50%; background:var(--primary); box-shadow:0 0 0 5px rgba(155,93,229,.10); }

    .music-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:14px; }
    .music-card { position:relative; min-width:0; overflow:hidden; border:1px solid var(--line); border-radius:20px; background:rgba(255,255,255,.86); box-shadow:var(--shadow-sm); transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease; }
    .music-card:hover { transform:translateY(-3px); border-color:rgba(155,93,229,.20); box-shadow:var(--shadow-md); }
    .thumbnail-wrap { position:relative; aspect-ratio:16/9; overflow:hidden; background:linear-gradient(135deg,#eee8ff,#f8f5ff); }
    .thumbnail { display:block; width:100%; height:100%; object-fit:cover; }
    .play-badge { position:absolute; left:10px; bottom:10px; width:38px; height:38px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.65); border-radius:13px; background:rgba(72,47,99,.78); color:#fff; box-shadow:0 8px 22px rgba(49,33,68,.25); }
    .play-badge svg { width:17px; height:17px; margin-left:2px; }
    .music-position { position:absolute; top:10px; right:10px; padding:5px 8px; border:1px solid rgba(255,255,255,.62); border-radius:10px; background:rgba(72,47,99,.72); color:#fff; font-size:10px; font-weight:850; }
    .music-info { min-height:91px; padding:13px 14px 14px; }
    .music-label { color:var(--primary-strong); font-size:10px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; }
    .music-title { display:-webkit-box; overflow:hidden; margin-top:5px; color:var(--text); font-size:19px; line-height:1.18; font-weight:700; -webkit-line-clamp:2; -webkit-box-orient:vertical; }

    .empty-state { display:none; margin-top:14px; padding:26px 16px; border:1px dashed rgba(117,101,132,.16); border-radius:18px; background:rgba(255,255,255,.48); color:var(--muted); line-height:1.6; text-align:center; }
    .empty-state.visible { display:block; }
    .empty-state strong { display:block; margin-bottom:4px; color:var(--text); font-size:21px; }

    @media (max-width:640px) { .music-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="navigation-button" href="home.html" aria-label="Voltar para home">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="navigation-label">Home</span>
      </a>
      <a class="icon-button" href="galeria.html" aria-label="Galeria">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 14l2.5-3 2.5 2.5 2.5-4 4 5.5H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    </header>

    <main class="container">
      <div class="eyebrow">Playlist</div>
      <h1>Nossas Músicas</h1>
      <p class="subtitulo">Uma trilha para acompanhar os melhores momentos.</p>

      <section class="overview">
        <div class="overview-card">
          <div class="overview-label">Coleção</div>
          <div class="lista-titulo">Momentos musicais</div>
          <div class="collection-note">Tocadas com carinho, sempre.</div>
        </div>
        <div class="contador" id="musicCount">0 faixas</div>
      </section>

      <div class="status"><span class="status-dot"></span><span id="statusText">Carregando trilha...</span></div>

      <section id="musicGrid" class="music-grid" aria-live="polite"></section>

      <div id="emptyState" class="empty-state">
        <strong>Nenhuma música</strong>
        Ainda não há faixas para mostrar.
      </div>
    </main>
  </div>

  <script src="config.js"></script>
  <script src="utils.js"></script>
  <script>
    if (!Utils.Auth.isLoggedIn()) {
      window.location.href = LOOOPLY_CONFIG.ROUTES.LOGIN;
    }

    const musicTracks = [
      { title: 'Eu e Você', artist: 'Trilha do momento', image: 'Screenshot_20260907_220115_Instagram.jpg', url: 'https://www.youtube.com/results?search_query=eu+e+voce+musica' },
      { title: 'Pelo Mundo', artist: 'Playlist especial', image: '20260925_170903.jpg', url: 'https://www.youtube.com/results?search_query=pelo+mundo+musica' },
      { title: 'Sempressa', artist: 'Belo som', image: '20260921_150554.jpg', url: 'https://www.youtube.com/results?search_query=sempressa+musica' },
      { title: 'Luz da Minha Vida', artist: 'Favorita', image: '20260925_180500.jpg', url: 'https://www.youtube.com/results?search_query=luz+da+minha+vida+musica' }
    ];

    const musicGrid = document.getElementById('musicGrid');
    const musicCount = document.getElementById('musicCount');
    const statusText = document.getElementById('statusText');
    const emptyState = document.getElementById('emptyState');

    function renderTracks() {
      musicGrid.innerHTML = '';
      if (!musicTracks.length) {
        emptyState.classList.add('visible');
        musicCount.textContent = '0 faixas';
        statusText.textContent = 'Nenhuma trilha disponível.';
        return;
      }

      emptyState.classList.remove('visible');
      musicTracks.forEach((track, index) => {
        const card = document.createElement('article');
        card.className = 'music-card';
        card.innerHTML = `
          <div class="thumbnail-wrap">
            <img class="thumbnail" src="${track.image}" alt="${track.title}" loading="lazy" />
            <div class="music-position">#${index + 1}</div>
            <div class="play-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor"/></svg>
            </div>
          </div>
          <div class="music-info">
            <div class="music-label">${track.artist}</div>
            <div class="music-title">${track.title}</div>
          </div>
        `;
        card.addEventListener('click', () => window.open(track.url, '_blank', 'noopener,noreferrer'));
        musicGrid.appendChild(card);
      });

      musicCount.textContent = `${musicTracks.length} faixas`;
      statusText.textContent = 'Trilha pronta para você ouvir.';
    }

    renderTracks();
  </script>
</body>
</html>
