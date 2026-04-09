/* ============================================
   ZIVA CATALYST — JavaScript
   Interactivity, CRO enhancements, animations
   ============================================ */

(function () {
  "use strict";

  // ---------- Header Scroll Effect ----------
  const header = document.getElementById("header");

  function handleScroll() {
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  }

  window.addEventListener("scroll", handleScroll, { passive: true });

  // ---------- Mobile Menu Toggle ----------
  const menuToggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav");

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("open");
      menuToggle.classList.toggle("active");
      menuToggle.setAttribute("aria-expanded", isOpen);
    });

    // Close menu when a nav link is clicked
    nav.querySelectorAll(".nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        menuToggle.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---------- Smooth Scroll for Anchor Links ----------
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var targetId = this.getAttribute("href");
      if (targetId === "#") return;

      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ---------- Scroll-triggered Fade-in Animations ----------
  function setupFadeAnimations() {
    var animatedElements = document.querySelectorAll(
      ".service-card, .platform-card, .process-step, .stat-card, " +
      ".testimonial-card, .highlight-card, .faq-item, .info-card"
    );

    animatedElements.forEach(function (el) {
      el.classList.add("fade-in");
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    animatedElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // ---------- Animated Number Counters (CRO: Social Proof) ----------
  function setupCounters() {
    var counters = document.querySelectorAll(".stat-number[data-target]");

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach(function (counter) {
      observer.observe(counter);
    });
  }

  function animateCounter(element) {
    var target = parseInt(element.getAttribute("data-target"), 10);
    var duration = 2000;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      element.textContent = Math.floor(eased * target);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = target;
      }
    }

    requestAnimationFrame(step);
  }

  // ---------- Contact Form Handling (CRO: Lead Capture) ----------
  var contactForm = document.getElementById("contactForm");

  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var submitBtn = contactForm.querySelector('button[type="submit"]');
      var originalText = submitBtn.textContent;

      // Show loading state
      submitBtn.textContent = "Sending...";
      submitBtn.disabled = true;

      // Simulate form submission (replace with actual endpoint)
      setTimeout(function () {
        submitBtn.textContent = "Message Sent Successfully!";
        submitBtn.style.background = "linear-gradient(135deg, #00C9A7, #00A88A)";
        submitBtn.style.borderColor = "#00C9A7";

        // Reset form
        contactForm.reset();

        // Restore button after 3 seconds
        setTimeout(function () {
          submitBtn.textContent = originalText;
          submitBtn.style.background = "";
          submitBtn.style.borderColor = "";
          submitBtn.disabled = false;
        }, 3000);
      }, 1000);
    });
  }

  // ---------- Active Nav Link Highlight on Scroll ----------
  function setupActiveNav() {
    var sections = document.querySelectorAll("section[id]");
    var navLinks = document.querySelectorAll(".nav-link");

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.getAttribute("id");
            navLinks.forEach(function (link) {
              link.classList.remove("active");
              if (link.getAttribute("href") === "#" + id) {
                link.classList.add("active");
              }
            });
          }
        });
      },
      { threshold: 0.3, rootMargin: "-80px 0px -50% 0px" }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  // ---------- Initialize Everything ----------
  document.addEventListener("DOMContentLoaded", function () {
    setupFadeAnimations();
    setupCounters();
    setupActiveNav();
    handleScroll(); // Check initial scroll position
  });
})();
