/* ============================================
   ZIVA CATALYST — Admin Panel JavaScript
   Auth, Blog Editor, GitHub API Integration
   ============================================ */
(function () {
  "use strict";

  // ---- Config ----
  var CONFIG = {
    REPO: "mousami6288-sys/zeeva",
    BRANCH: "claude/ziva-catalyst-website-8KfY8",
    STORAGE_PREFIX: "ziva_admin_"
  };

  // ---- Utility: SHA-256 hash ----
  function sha256(str) {
    var encoder = new TextEncoder();
    var data = encoder.encode(str);
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  // ---- Storage helpers ----
  function store(key, val) {
    localStorage.setItem(CONFIG.STORAGE_PREFIX + key, JSON.stringify(val));
  }
  function load(key) {
    var v = localStorage.getItem(CONFIG.STORAGE_PREFIX + key);
    return v ? JSON.parse(v) : null;
  }
  function storeSession(key, val) {
    sessionStorage.setItem(CONFIG.STORAGE_PREFIX + key, val);
  }
  function loadSession(key) {
    return sessionStorage.getItem(CONFIG.STORAGE_PREFIX + key);
  }

  // ---- Check if we are on the login page or dashboard ----
  var isLoginPage = document.getElementById("loginForm") !== null;
  var isDashboard = document.getElementById("sidebar") !== null;

  // ============================================================
  //  LOGIN PAGE LOGIC
  // ============================================================
  if (isLoginPage) {
    var loginForm = document.getElementById("loginForm");
    var setupPanel = document.getElementById("setupPanel");
    var setupForm = document.getElementById("setupForm");
    var loginError = document.getElementById("loginError");
    var togglePw = document.getElementById("togglePassword");
    var pwInput = document.getElementById("password");

    // Check if credentials exist
    var creds = load("credentials");
    if (!creds) {
      // First time: show setup
      loginForm.parentElement.hidden = true;
      setupPanel.hidden = false;
    }

    // Toggle password visibility
    if (togglePw) {
      togglePw.addEventListener("click", function () {
        var isHidden = pwInput.type === "password";
        pwInput.type = isHidden ? "text" : "password";
      });
    }

    // Login
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      loginError.hidden = true;
      var email = document.getElementById("email").value.trim();
      var password = document.getElementById("password").value;
      var creds = load("credentials");
      if (!creds) { loginError.hidden = false; return; }

      sha256(password).then(function (hash) {
        if (email === creds.email && hash === creds.passwordHash) {
          storeSession("auth", "true");
          window.location.href = "dashboard.html";
        } else {
          loginError.hidden = false;
        }
      });
    });

    // First-time setup
    if (setupForm) {
      setupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var setupError = document.getElementById("setupError");
        setupError.hidden = true;

        var email = document.getElementById("setupEmail").value.trim();
        var pw = document.getElementById("setupPassword").value;
        var confirm = document.getElementById("setupConfirm").value;
        var token = document.getElementById("setupToken").value.trim();

        if (pw !== confirm) {
          setupError.textContent = "Passwords do not match.";
          setupError.hidden = false;
          return;
        }
        if (pw.length < 6) {
          setupError.textContent = "Password must be at least 6 characters.";
          setupError.hidden = false;
          return;
        }

        sha256(pw).then(function (hash) {
          store("credentials", { email: email, passwordHash: hash });
          store("github_token", token);
          store("settings", { email: email, repo: CONFIG.REPO, branch: CONFIG.BRANCH });
          storeSession("auth", "true");
          window.location.href = "dashboard.html";
        });
      });
    }
  }

  // ============================================================
  //  DASHBOARD LOGIC
  // ============================================================
  if (isDashboard) {
    // Auth guard
    if (loadSession("auth") !== "true") {
      window.location.href = "index.html";
      return;
    }

    var creds = load("credentials");
    var topbarUser = document.getElementById("topbarUser");
    if (topbarUser && creds) topbarUser.textContent = creds.email;

    // ---- Sidebar Navigation ----
    var sidebarLinks = document.querySelectorAll(".sidebar-link[data-panel]");
    var panels = document.querySelectorAll(".panel");

    function switchPanel(panelId) {
      panels.forEach(function (p) { p.classList.remove("active"); });
      sidebarLinks.forEach(function (l) { l.classList.remove("active"); });
      var target = document.getElementById(panelId);
      if (target) target.classList.add("active");
      sidebarLinks.forEach(function (l) {
        if (l.getAttribute("data-panel") === panelId) l.classList.add("active");
      });
    }

    sidebarLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        switchPanel(this.getAttribute("data-panel"));
        // Close mobile sidebar
        document.getElementById("sidebar").classList.remove("open");
      });
    });

    // Quick action buttons
    document.querySelectorAll("[data-goto]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchPanel(this.getAttribute("data-goto"));
      });
    });

    // Mobile sidebar toggle
    var sidebarToggle = document.getElementById("sidebarToggle");
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", function () {
        document.getElementById("sidebar").classList.toggle("open");
      });
    }

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", function () {
      sessionStorage.clear();
      window.location.href = "index.html";
    });

    // ---- GitHub API Helper ----
    function ghToken() {
      return load("github_token") || "";
    }

    function ghAPI(path, options) {
      var opts = options || {};
      var headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": "Bearer " + ghToken()
      };
      if (opts.body) headers["Content-Type"] = "application/json";

      return fetch("https://api.github.com/repos/" + CONFIG.REPO + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            throw new Error(err.message || "GitHub API error " + res.status);
          });
        }
        return res.status === 204 ? null : res.json();
      });
    }

    // ---- Load Blog Posts from Repo ----
    function loadBlogPosts() {
      return ghAPI("/contents/blog?ref=" + CONFIG.BRANCH).then(function (files) {
        return files.filter(function (f) {
          return f.name.endsWith(".html") && f.name !== "index.html";
        });
      }).catch(function () {
        return [];
      });
    }

    function renderPosts(posts, containerId, limit) {
      var container = document.getElementById(containerId);
      if (!container) return;

      var items = limit ? posts.slice(0, limit) : posts;
      if (items.length === 0) {
        container.innerHTML = '<p class="loading-text">No blog posts found. Write your first post!</p>';
        return;
      }

      container.innerHTML = items.map(function (f) {
        var name = f.name.replace(".html", "").replace(/-/g, " ");
        // Capitalize first letter of each word
        name = name.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        return '<div class="post-item">' +
          '<div class="post-item-info">' +
          '<div class="post-item-title">' + name + '</div>' +
          '<div class="post-item-meta">' + f.name + ' &middot; ' + (f.size / 1024).toFixed(1) + ' KB</div>' +
          '</div>' +
          '<div class="post-item-actions">' +
          '<a href="../blog/' + f.name + '" target="_blank" class="btn btn-outline btn-sm">View</a>' +
          '<button class="btn btn-danger btn-sm" onclick="window.ZivaAdmin.deletePost(\'' + f.name + '\', \'' + f.sha + '\')">Delete</button>' +
          '</div></div>';
      }).join("");
    }

    function refreshPosts() {
      loadBlogPosts().then(function (posts) {
        document.getElementById("totalPosts").textContent = posts.length;
        renderPosts(posts, "recentPosts", 5);
        renderPosts(posts, "allPosts");
      });
    }

    refreshPosts();

    // ---- Delete Blog Post ----
    window.ZivaAdmin = {
      deletePost: function (filename, sha) {
        if (!confirm("Delete \"" + filename + "\"? This cannot be undone.")) return;
        ghAPI("/contents/blog/" + filename, {
          method: "DELETE",
          body: { message: "Delete blog post: " + filename, sha: sha, branch: CONFIG.BRANCH }
        }).then(function () {
          alert("Post deleted. It may take a minute for GitHub Pages to update.");
          refreshPosts();
        }).catch(function (err) {
          alert("Error: " + err.message);
        });
      }
    };

    // ---- Blog Post Form ----
    var postForm = document.getElementById("blogPostForm");
    var postTitle = document.getElementById("postTitle");
    var postSlug = document.getElementById("postSlug");
    var titleCount = document.getElementById("titleCount");
    var metaDescCount = document.getElementById("metaDescCount");
    var postMetaDesc = document.getElementById("postMetaDesc");
    var postDate = document.getElementById("postDate");

    // Set default date to today
    postDate.value = new Date().toISOString().split("T")[0];

    // Auto-generate slug from title
    postTitle.addEventListener("input", function () {
      titleCount.textContent = this.value.length + "/100";
      postSlug.value = this.value.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .substring(0, 80);
    });

    postMetaDesc.addEventListener("input", function () {
      metaDescCount.textContent = this.value.length + "/160";
    });

    // Rich text toolbar
    document.querySelectorAll(".toolbar-btn[data-cmd]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cmd = this.getAttribute("data-cmd");
        var val = this.getAttribute("data-val") || null;
        document.execCommand(cmd, false, val);
        document.getElementById("postBody").focus();
      });
    });

    // Insert link button
    document.getElementById("insertLinkBtn").addEventListener("click", function () {
      var url = prompt("Enter URL:", "https://");
      if (url) document.execCommand("createLink", false, url);
    });

    // ---- Generate Blog Post HTML ----
    function generatePostHTML(data) {
      var dateObj = new Date(data.date + "T09:00:00");
      var dateFormatted = dateObj.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      var isoDate = data.date;

      return '<!DOCTYPE html>\n' +
        '<html lang="en" dir="ltr">\n<head>\n' +
        '  <!-- Google tag (gtag.js) -->\n' +
        '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-7CWNGP7WX2"><\/script>\n' +
        '  <script>\n    window.dataLayer = window.dataLayer || [];\n' +
        '    function gtag(){dataLayer.push(arguments);}\n' +
        '    gtag("js", new Date());\n    gtag("config", "G-7CWNGP7WX2");\n  <\/script>\n\n' +
        '  <meta charset="UTF-8" />\n' +
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
        '  <title>' + data.title + ' | Ziva Catalyst</title>\n' +
        '  <meta name="description" content="' + data.metaDesc.replace(/"/g, '&quot;') + '" />\n' +
        '  <meta name="keywords" content="' + data.keywords.replace(/"/g, '&quot;') + '" />\n' +
        '  <meta name="author" content="Mausmi Valambhiya" />\n' +
        '  <meta name="robots" content="index, follow" />\n' +
        '  <link rel="canonical" href="https://zivacatalyst.com/blog/' + data.slug + '.html" />\n\n' +
        '  <meta property="og:type" content="article" />\n' +
        '  <meta property="og:title" content="' + data.title.replace(/"/g, '&quot;') + '" />\n' +
        '  <meta property="og:description" content="' + data.metaDesc.replace(/"/g, '&quot;') + '" />\n' +
        '  <meta property="og:url" content="https://zivacatalyst.com/blog/' + data.slug + '.html" />\n' +
        '  <meta property="article:published_time" content="' + isoDate + '" />\n' +
        '  <meta property="article:author" content="Mausmi Valambhiya" />\n' +
        '  <meta property="article:section" content="' + data.category + '" />\n\n' +
        '  <meta name="twitter:card" content="summary_large_image" />\n' +
        '  <meta name="twitter:title" content="' + data.title.replace(/"/g, '&quot;') + '" />\n' +
        '  <meta name="twitter:description" content="' + data.metaDesc.replace(/"/g, '&quot;') + '" />\n\n' +
        '  <script type="application/ld+json">\n' +
        '  ' + JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": data.title,
          "description": data.metaDesc,
          "author": { "@type": "Person", "name": "Mausmi Valambhiya", "jobTitle": "Social Media Marketing Strategist" },
          "publisher": { "@type": "Organization", "name": "Ziva Catalyst" },
          "datePublished": isoDate,
          "dateModified": isoDate,
          "articleSection": data.category,
          "keywords": data.keywords
        }, null, 2) + '\n  <\/script>\n\n' +
        '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
        '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />\n' +
        '  <link rel="stylesheet" href="../style.css" />\n' +
        '  <link rel="stylesheet" href="blog.css" />\n' +
        '</head>\n<body>\n\n' +
        '  <a href="#main-content" class="skip-link">Skip to main content</a>\n\n' +
        '  <header class="header scrolled" id="header">\n    <div class="container">\n' +
        '      <a href="../index.html" class="logo"><span class="logo-icon">Z</span><span class="logo-text">Ziva <strong>Catalyst</strong></span></a>\n' +
        '      <nav class="nav" id="nav"><ul class="nav-list">\n' +
        '        <li><a href="../index.html#about" class="nav-link">About</a></li>\n' +
        '        <li><a href="../index.html#services" class="nav-link">Services</a></li>\n' +
        '        <li><a href="index.html" class="nav-link">Blog</a></li>\n' +
        '        <li><a href="../index.html#contact" class="nav-link cta-link">Get Started</a></li>\n' +
        '      </ul></nav>\n' +
        '      <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu"><span class="bar"></span><span class="bar"></span><span class="bar"></span></button>\n' +
        '    </div>\n  </header>\n\n' +
        '  <main id="main-content">\n' +
        '    <section class="article-hero"><div class="container">\n' +
        '      <nav class="breadcrumbs"><a href="../index.html">Home</a><span>&rsaquo;</span><a href="index.html">Blog</a><span>&rsaquo;</span><span class="current">' + data.title + '</span></nav>\n' +
        '      <div class="article-meta"><span class="article-category">' + data.category + '</span><span class="article-date">' + dateFormatted + '</span><span class="article-read-time">' + data.readTime + '</span></div>\n' +
        '      <h1 class="article-title">' + data.title + '</h1>\n' +
        '      <div class="article-author"><div class="author-avatar">M</div><div class="author-info"><strong>By Mausmi Valambhiya</strong><span>Founder, Ziva Catalyst</span></div></div>\n' +
        '    </div></section>\n\n' +
        '    <article class="article-body"><div class="container article-container">\n' +
        '      ' + data.body + '\n\n' +
        '      <div class="article-cta"><h3>Ready to Grow Your Brand?</h3><p>Get a personalized strategy for your business.</p>' +
        '<a href="../index.html#contact" class="btn btn-primary btn-lg">Book a Free Consultation</a></div>\n\n' +
        '      <div class="author-bio"><div class="author-bio-avatar">M</div><div class="author-bio-content">' +
        '<h4>About the Author</h4><p><strong>Mausmi Valambhiya</strong> is the founder of Ziva Catalyst — a social media marketing strategist with an MBA in Marketing and 10+ years of experience.</p>' +
        '</div></div>\n' +
        '    </div></article>\n' +
        '  </main>\n\n' +
        '  <footer class="footer"><div class="container"><div class="footer-bottom">' +
        '<p>&copy; 2024 Ziva Catalyst — Service Brand of Mausmi Valambhiya. All rights reserved.</p>' +
        '</div></div></footer>\n\n' +
        '  <script src="../script.js"><\/script>\n' +
        '</body>\n</html>';
    }

    // ---- Update Blog Index (listing page) ----
    function updateBlogIndex(posts) {
      var cardsHTML = posts.map(function (f, i) {
        var name = f.name.replace(".html", "").replace(/-/g, " ");
        name = name.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        var cls = i === 0 ? 'blog-card featured-post' : 'blog-card';
        return '<article class="' + cls + '">' +
          '<div class="blog-card-image"><div class="blog-card-icon">ZC</div></div>' +
          '<div class="blog-card-content">' +
          '<div class="blog-card-meta"><span class="blog-card-category">Social Media Marketing</span></div>' +
          '<h2 class="blog-card-title"><a href="' + f.name + '">' + name + '</a></h2>' +
          '<a href="' + f.name + '" class="blog-card-link">Read Article &rarr;</a>' +
          '</div></article>';
      }).join("\n          ");

      var html = '<!DOCTYPE html>\n<html lang="en" dir="ltr">\n<head>\n' +
        '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-7CWNGP7WX2"><\/script>\n' +
        '  <script>\n    window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-7CWNGP7WX2");\n  <\/script>\n' +
        '  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" />\n' +
        '  <title>Blog | Ziva Catalyst</title>\n' +
        '  <meta name="description" content="Expert social media marketing insights from Mausmi Valambhiya." />\n' +
        '  <meta name="robots" content="index, follow" />\n' +
        '  <link rel="canonical" href="https://zivacatalyst.com/blog/" />\n' +
        '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
        '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />\n' +
        '  <link rel="stylesheet" href="../style.css" />\n  <link rel="stylesheet" href="blog.css" />\n' +
        '</head>\n<body>\n' +
        '  <header class="header scrolled" id="header"><div class="container">\n' +
        '    <a href="../index.html" class="logo"><span class="logo-icon">Z</span><span class="logo-text">Ziva <strong>Catalyst</strong></span></a>\n' +
        '    <nav class="nav" id="nav"><ul class="nav-list">\n' +
        '      <li><a href="../index.html#about" class="nav-link">About</a></li>\n' +
        '      <li><a href="../index.html#services" class="nav-link">Services</a></li>\n' +
        '      <li><a href="index.html" class="nav-link">Blog</a></li>\n' +
        '      <li><a href="../index.html#contact" class="nav-link cta-link">Get Started</a></li>\n' +
        '    </ul></nav>\n' +
        '    <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu"><span class="bar"></span><span class="bar"></span><span class="bar"></span></button>\n' +
        '  </div></header>\n' +
        '  <main id="main-content">\n' +
        '    <section class="blog-hero"><div class="container">\n' +
        '      <p class="section-tag">The Ziva Catalyst Blog</p>\n' +
        '      <h1 class="blog-hero-title">Insights That <span class="highlight">Ignite Growth</span></h1>\n' +
        '    </div></section>\n' +
        '    <section class="section blog-list-section"><div class="container">\n' +
        '      <div class="blog-grid">\n          ' + cardsHTML + '\n      </div>\n' +
        '      <div class="blog-newsletter"><h3>Want More Marketing Insights?</h3><p>Book a free consultation for personalized recommendations.</p>' +
        '<a href="../index.html#contact" class="btn btn-primary btn-lg">Book a Free Consultation</a></div>\n' +
        '    </div></section>\n  </main>\n' +
        '  <footer class="footer"><div class="container"><div class="footer-bottom">' +
        '<p>&copy; 2024 Ziva Catalyst — Service Brand of Mausmi Valambhiya.</p></div></div></footer>\n' +
        '  <script src="../script.js"><\/script>\n</body>\n</html>';

      return html;
    }

    // ---- Publish Blog Post via GitHub API ----
    function showStatus(id, msg, type) {
      var el = document.getElementById(id);
      el.hidden = false;
      el.className = "publish-status " + type;
      el.textContent = msg;
    }

    postForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = document.getElementById("publishBtn");
      btn.disabled = true;
      btn.textContent = "Publishing...";
      showStatus("publishStatus", "Generating blog post and publishing to GitHub...", "info");

      var data = {
        title: postTitle.value.trim(),
        slug: postSlug.value.trim(),
        category: document.getElementById("postCategory").value,
        readTime: document.getElementById("postReadTime").value,
        date: postDate.value,
        body: document.getElementById("postBody").innerHTML,
        metaDesc: postMetaDesc.value.trim(),
        keywords: document.getElementById("postKeywords").value.trim()
      };

      if (!data.title || !data.slug || !data.metaDesc) {
        showStatus("publishStatus", "Please fill in all required fields.", "error");
        btn.disabled = false;
        btn.textContent = "Publish to Website";
        return;
      }

      var filename = data.slug + ".html";
      var htmlContent = generatePostHTML(data);
      var encodedContent = btoa(unescape(encodeURIComponent(htmlContent)));

      // Step 1: Create the blog post file
      ghAPI("/contents/blog/" + filename, {
        method: "PUT",
        body: {
          message: "Add blog post: " + data.title,
          content: encodedContent,
          branch: CONFIG.BRANCH
        }
      }).then(function () {
        showStatus("publishStatus", "Blog post created! Updating blog listing page...", "info");
        // Step 2: Refresh posts and update blog/index.html
        return loadBlogPosts();
      }).then(function (posts) {
        var indexHTML = updateBlogIndex(posts);
        var encodedIndex = btoa(unescape(encodeURIComponent(indexHTML)));
        // Get current SHA of blog/index.html
        return ghAPI("/contents/blog/index.html?ref=" + CONFIG.BRANCH).then(function (file) {
          return ghAPI("/contents/blog/index.html", {
            method: "PUT",
            body: {
              message: "Update blog listing with new post: " + data.title,
              content: encodedIndex,
              sha: file.sha,
              branch: CONFIG.BRANCH
            }
          });
        });
      }).then(function () {
        showStatus("publishStatus", "Published successfully! Your post will be live in 1-2 minutes after GitHub Pages rebuilds.", "success");
        btn.textContent = "Published!";
        postForm.reset();
        document.getElementById("postBody").innerHTML = "<p>Start writing your blog post here...</p>";
        postDate.value = new Date().toISOString().split("T")[0];
        refreshPosts();
        setTimeout(function () {
          btn.disabled = false;
          btn.textContent = "Publish to Website";
        }, 3000);
      }).catch(function (err) {
        showStatus("publishStatus", "Error: " + err.message + ". Check your GitHub token in Settings.", "error");
        btn.disabled = false;
        btn.textContent = "Publish to Website";
      });
    });

    // ---- Preview ----
    document.getElementById("previewBtn").addEventListener("click", function () {
      var data = {
        title: postTitle.value.trim() || "Untitled Post",
        slug: postSlug.value.trim() || "preview",
        category: document.getElementById("postCategory").value,
        readTime: document.getElementById("postReadTime").value,
        date: postDate.value,
        body: document.getElementById("postBody").innerHTML,
        metaDesc: postMetaDesc.value.trim(),
        keywords: document.getElementById("postKeywords").value.trim()
      };
      var html = generatePostHTML(data);
      var modal = document.getElementById("previewModal");
      var frame = document.getElementById("previewFrame");
      modal.hidden = false;
      frame.srcdoc = html;
    });

    document.getElementById("closePreview").addEventListener("click", function () {
      document.getElementById("previewModal").hidden = true;
    });

    // ---- Settings Form ----
    var settingsForm = document.getElementById("settingsForm");
    var savedSettings = load("settings") || {};
    // Populate saved settings
    if (savedSettings.email) document.getElementById("settingsEmail").value = savedSettings.email;
    if (savedSettings.phone) document.getElementById("settingsPhone").value = savedSettings.phone;
    if (savedSettings.linkedin) document.getElementById("settingsLinkedIn").value = savedSettings.linkedin;
    if (savedSettings.instagram) document.getElementById("settingsInstagram").value = savedSettings.instagram;
    if (savedSettings.facebook) document.getElementById("settingsFacebook").value = savedSettings.facebook;
    if (savedSettings.youtube) document.getElementById("settingsYouTube").value = savedSettings.youtube;
    if (savedSettings.branch) document.getElementById("settingsBranch").value = savedSettings.branch;
    var savedToken = load("github_token");
    if (savedToken) document.getElementById("settingsToken").value = savedToken;

    settingsForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var settings = {
        email: document.getElementById("settingsEmail").value.trim(),
        phone: document.getElementById("settingsPhone").value.trim(),
        linkedin: document.getElementById("settingsLinkedIn").value.trim(),
        instagram: document.getElementById("settingsInstagram").value.trim(),
        facebook: document.getElementById("settingsFacebook").value.trim(),
        youtube: document.getElementById("settingsYouTube").value.trim(),
        repo: CONFIG.REPO,
        branch: document.getElementById("settingsBranch").value.trim()
      };
      store("settings", settings);
      CONFIG.BRANCH = settings.branch;

      var token = document.getElementById("settingsToken").value.trim();
      if (token) store("github_token", token);

      // Handle password change
      var currentPw = document.getElementById("currentPw").value;
      var newPw = document.getElementById("newPw").value;
      var confirmPw = document.getElementById("confirmPw").value;

      if (currentPw && newPw) {
        if (newPw !== confirmPw) {
          showStatus("settingsStatus", "New passwords do not match.", "error");
          return;
        }
        if (newPw.length < 6) {
          showStatus("settingsStatus", "New password must be at least 6 characters.", "error");
          return;
        }
        var creds = load("credentials");
        sha256(currentPw).then(function (hash) {
          if (hash !== creds.passwordHash) {
            showStatus("settingsStatus", "Current password is incorrect.", "error");
            return;
          }
          return sha256(newPw).then(function (newHash) {
            creds.passwordHash = newHash;
            store("credentials", creds);
            showStatus("settingsStatus", "Settings and password saved successfully!", "success");
            document.getElementById("currentPw").value = "";
            document.getElementById("newPw").value = "";
            document.getElementById("confirmPw").value = "";
          });
        });
      } else {
        showStatus("settingsStatus", "Settings saved successfully!", "success");
      }
    });
  }

})();
