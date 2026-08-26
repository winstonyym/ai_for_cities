#!/usr/bin/env python3
"""Static generator for the AI for Cities site.

Emits index.html, people/*.html and projects/*.html from one shell so the
navigation, footer and head stay identical across every page.
"""
import os, html, textwrap

ROOT = os.path.dirname(os.path.abspath(__file__))

SITE_NAME = "AI for Cities"
TAGLINE = "From urban data to real-world impact"
EMAIL = "winyap@cornell.edu"

# --------------------------------------------------------------------------
# People
# --------------------------------------------------------------------------

PEOPLE = [
    dict(
        slug="oliver-gao",
        name="H. Oliver Gao",
        short="Oliver Gao",
        role="PI",
        group="team",
        group_label="Research Team",
        affil="Howard Simpson 1942 Professor of Engineering",
        affil2="Director, Systems Engineering Program · Cornell University",
        bio=[
            "H. Oliver Gao is the Howard Simpson 1942 Professor of Engineering at Cornell "
            "University and director of Cornell's Systems Engineering Program. He also "
            "directs the Center for Transportation, Environment, and Community Health "
            "(CTECH) and leads the Global Analytics Observatory, a research hub for "
            "systems innovation across climate, infrastructure and public health.",
            "His research applies data science and systems analytics to sustainable urban "
            "development, spanning transportation and infrastructure systems, air quality "
            "and exposure risk, energy and climate policy, and public health analytics. "
            "Recent work ranges from clean-technology assessment and low-emission mobility "
            "to AI-driven digital twins for city planning.",
            "Within AI for Cities he sets the research agenda, connects the group to "
            "Cornell's wider systems and infrastructure community, and advises on how "
            "modelling work translates into policy and deployment.",
        ],
        focus=["Systems analytics", "Transportation & air quality",
               "Infrastructure & energy", "Public health analytics", "Climate policy"],
        meta=[("Department", "Systems Engineering · Civil and Environmental Engineering"),
              ("Centers", "CTECH · Global Analytics Observatory"),
              ("Institution", "Cornell Duffield Engineering, Ithaca NY")],
        links=[("Cornell profile", "https://www.duffield.cornell.edu/people/h-oliver-gao/"),
               ("Global Analytics Observatory", "https://gao.cee.cornell.edu/")],
    ),
    dict(
        slug="winston-yap",
        name="Winston Yap",
        short="Winston Yap",
        role="Lead",
        group="team",
        group_label="Research Team",
        affil="Project Lead, AI for Cities",
        affil2="Systems Engineering · Cornell Duffield Engineering",
        bio=[
            "Winston Yap leads AI for Cities day to day — setting the research roadmap, "
            "building the group's modelling and data infrastructure, and mentoring the "
            "student leads across each workstream.",
            "He holds a doctorate in urban analytics from the National University of "
            "Singapore, where his work at the NUS Urban Analytics Lab centred on urban "
            "analytics and 3D city modelling for the planning process. He is the author of "
            "<strong>Urbanity</strong>, an open, feature-rich global network dataset and "
            "toolkit for city-scale analysis, and contributed to <strong>Global "
            "Streetscapes</strong>, a dataset of ten million street-level images across 688 "
            "cities, and <strong>VoxCity</strong>, a framework for generating semantic 3D "
            "city models from open geospatial data. Before his doctorate he was a research "
            "associate at the Lee Kuan Yew Centre for Innovative Cities, working on "
            "age-friendly planning and citizen science in Southeast Asian cities.",
            "At Cornell he built <strong>Heatscape NYC</strong>, the group's first public "
            "tool: a 250-metre grid over New York City that scores every populated cell for "
            "heat risk and matches it to the cooling intervention its context actually "
            "supports.",
        ],
        focus=["Urban analytics", "Geospatial deep learning", "3D city modelling",
               "Urban digital twins", "Open urban data"],
        meta=[("Office", "Carpenter Hall B1C"),
              ("Email", '<a href="mailto:winyap@cornell.edu">winyap@cornell.edu</a>'),
              ("Address", "313 Campus Rd, Ithaca, NY 14853")],
        links=[("Google Scholar", "https://scholar.google.com/citations?user=p14e60QAAAAJ"),
               ("GitHub", "https://github.com/winstonyym"),
               ("Urbanity", "https://github.com/winstonyym/urbanity")],
    ),
    dict(
        slug="charlle-sy",
        name="Charlle Sy",
        short="Charlle Sy",
        role="Faculty",
        group="team",
        group_label="Research Team",
        affil="Professor of Practice, Systems Engineering",
        affil2="Cornell Duffield Engineering · De La Salle University",
        bio=[
            "Charlle Sy is a Professor of Practice in the Systems Engineering Program at "
            "Cornell Duffield Engineering and a professor of industrial engineering at De "
            "La Salle University in Manila.",
            "Her research sits where robust optimization meets systems thinking. She "
            "developed <strong>Target-Oriented Robust Optimization (TORO)</strong>, an "
            "approach to decision-making under deep uncertainty that keeps the resulting "
            "problems computationally tractable, and has applied it to infrastructure and "
            "network planning across energy, production and water systems.",
            "Within AI4C she stress-tests how the group handles uncertainty: "
            "how model assumptions are declared, how sensitive a recommendation is to them, "
            "and what a decision-maker should do when the evidence underneath is thin.",
        ],
        focus=["Robust optimization", "Systems thinking", "Energy & water systems",
               "Decision under uncertainty", "Industrial engineering"],
        meta=[("Program", "Systems Engineering, Cornell Duffield Engineering"),
              ("Also", "Department of Industrial Engineering, De La Salle University"),
              ("Method", "Target-Oriented Robust Optimization")],
        links=[("Cornell profile", "https://www.duffield.cornell.edu/people/charlle-sy/")],
    ),
    dict(
        slug="suzanne-charles",
        name="Suzanne Lanyi Charles",
        short="Suzanne Lanyi Charles",
        role="Faculty",
        group="team",
        group_label="Research Team",
        affil="Associate Professor of City and Regional Planning and Real Estate",
        affil2="College of Architecture, Art, and Planning · Cornell University",
        bio=[
            "Suzanne Lanyi Charles is an associate professor in the Department of City and "
            "Regional Planning and the Rubacha Department of Real Estate at Cornell's "
            "College of Architecture, Art, and Planning, where she directs the "
            "<strong>Housing + Property Lab</strong>.",
            "Her research examines how global capital investment reshapes housing markets "
            "and the neighbourhoods underneath them — the financialization of housing, "
            "suburban residential redevelopment, and what both mean for neighbourhood "
            "stability and a household's access to stable, affordable housing.",
            "She brings the housing and planning lens to AI4C: who is counted in an urban "
            "model, which interventions are actually deliverable through the property "
            "market and the planning system, and how a spatial recommendation lands on the "
            "people who live there.",
        ],
        focus=["Housing & neighbourhood change", "Financialization of housing",
               "Real estate & planning", "Suburban redevelopment", "Urban policy"],
        meta=[("Departments", "City and Regional Planning · Rubacha Department of Real Estate"),
              ("Lab", "Housing + Property Lab"),
              ("College", "Cornell AAP, Ithaca NY")],
        links=[("Cornell AAP profile", "https://aap.cornell.edu/planning/crp-people/"),
               ("Housing + Property Lab", "https://labs.aap.cornell.edu/housing-property-lab")],
    ),
    dict(
        slug="krishiv-vora",
        name="Krishiv Vora",
        short="Krishiv Vora",
        role="Urban Automation Team",
        group="team",
        group_label="Research Team",
        affil="M.Eng. Computer Science",
        affil2="Cornell University",
        bio=[
            "Krishiv Vora leads the urban automation workstream — the agents, pipelines and "
            "tooling that turn AI4C's research code into systems that keep running without "
            "a person in the loop.",
            "He is an M.Eng. computer science student at Cornell, focused on applying AI "
            "to domain-specific problems, which is what drew him to this project. He "
            "studied cognitive science with a machine learning specialization at UC San "
            "Diego, then spent three years at AMD building software infrastructure and "
            "tooling for GPU hardware simulation, where he worked extensively with "
            "AI-driven workflows and agentic automation.",
        ],
        quote="Excited to learn more about the project and use computation and AI to build "
              "real solutions with everyone.",
        focus=["Agentic automation", "ML systems", "Software infrastructure",
               "Domain-specific AI", "Tooling"],
        meta=[("Workstream", "Urban automation — agents, pipelines, tooling"),
              ("Program", "M.Eng. Computer Science, Cornell University"),
              ("Previously", "AMD · UC San Diego (Cognitive Science, ML)")],
        links=[],
    ),
    dict(
        slug="andrew-wu",
        name="Andrew Wu",
        short="Andrew Wu",
        role="Digital Intelligence Team",
        group="team",
        group_label="Research Team",
        affil="B.S. Electrical and Computer Engineering (intended)",
        affil2="Cornell Duffield Engineering",
        bio=[
            "Andrew Wu leads the digital twin workstream, building the 3D city "
            "representations and simulation scaffolding that the group's other models plug "
            "into.",
            "He is a first-year student in the College of Engineering, from Acton, "
            "Massachusetts, and intends to major in electrical and computer engineering. He "
            "has analysed air pollution measurements from NASA's TEMPO satellite and "
            "volunteered with his school's environmental activism club.",
        ],
        quote="I'm really excited to learn more about creating digital twins, which I "
              "believe will be crucial to modeling a sustainable environment for physical AI.",
        focus=["Urban digital twins", "3D city modelling", "Remote sensing",
               "Air quality data", "Simulation"],
        meta=[("Workstream", "Digital twin — 3D city models and simulation"),
              ("Program", "Engineering, Cornell University"),
              ("Previously", "NASA TEMPO satellite air-quality data analysis")],
        links=[],
    ),
]

PEOPLE_BY_SLUG = {p["slug"]: p for p in PEOPLE}

THEMES = [
    dict(n="01", title="Urban Digital Twin Platform",
         body="Scalable, efficient infrastructure for visualisation, analytics and "
              "simulation — the substrate every other workstream builds on.",
         color="rgba(67,170,139,0.9)", lead="andrew-wu"),
    dict(n="02", title="Spatial AI and Reasoning",
         body="Machine learning and data analytics for high-resolution spatial "
              "understanding: flow prediction, anomaly detection, and inference of the "
              "patterns cities leave in their data.",
         color="rgba(249,199,79,0.85)", lead="winston-yap"),
    dict(n="03", title="Agentic Geospatial Intelligence",
         body="Agentic tools, servers and knowledge infrastructure that let frontier "
              "models reason about places rather than just describe them.",
         color="rgba(214,58,58,0.85)", lead="krishiv-vora"),
    dict(n="04", title="Policy &amp; Deployment",
         body="Translating research into practice through municipal partnerships, pilot "
              "digital-twin deployments, and honest assessment of what changed in the "
              "planning decisions that followed.",
         color="rgba(87,117,144,0.95)", lead="oliver-gao"),
]

URIS_URL = "https://www.urismapper.com/"

INTERVENTIONS = [
    ("#8ab17d", "Plant street trees",
     "Heavy footfall on hot streets with little canopy."),
    ("#f9c74f", "Cool roofs",
     "Dense, dark built volume driving the heat island."),
    ("#43aa8b", "Outdoor cooling amenities",
     "Hot, busy streets far from a spray shower, with children present."),
    ("#f3722c", "Indoor cooling support",
     "Low air-conditioning coverage, elderly residents, distant cooling centres."),
    ("#577590", "Shaded pedestrian corridors",
     "High pedestrian flow and destination density with little shade accrual."),
    ("#90be6d", "New open &amp; green space",
     "Heat and social vulnerability where there is no park to reach."),
]

# --------------------------------------------------------------------------
# Shell
# --------------------------------------------------------------------------

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
    "%3Ccircle cx='16' cy='16' r='14' fill='%23070a10'/%3E"
    "%3Ccircle cx='16' cy='16' r='10' fill='none' stroke='%2343aa8b' stroke-width='1.4'/%3E"
    "%3Cellipse cx='16' cy='16' rx='4.4' ry='10' fill='none' stroke='%2343aa8b' "
    "stroke-width='1.1' opacity='.75'/%3E"
    "%3Cpath d='M6 16h20' stroke='%23d63a3a' stroke-width='1.3'/%3E%3C/svg%3E"
)


def head(title, desc, base, extra_css=""):
    return f"""<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>{title}</title>
<meta name="description" content="{desc}" />
<meta name="theme-color" content="#05070b" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:type" content="website" />
<link rel="icon" href="{FAVICON}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="{base}site/css/main.css" />
{extra_css}</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
"""


def nav(base, active=""):
    def cls(key):
        return ' class="nav__link is-active"' if key == active else ' class="nav__link"'
    return f"""
<header class="nav">
  <div class="wrap nav__inner">
    <a class="brand" href="{base}index.html" aria-label="AI for Cities — home">
      <img class="brand__logo" src="{base}site/img/logos/CornellDuffieldEngineering_OneLine_Logo_No_Seal_White.png" alt="Cornell Duffield Engineering" />
      <span class="brand__rule" aria-hidden="true"></span>
      <span class="brand__name">AI <em>for</em> Cities</span>
    </a>
    <nav class="nav__links" aria-label="Primary">
      <a{cls('research')} href="{base}index.html#research">Research</a>
      <a{cls('projects')} href="{base}projects/index.html">Projects</a>
      <a{cls('people')} href="{base}people/index.html">People</a>
      <a{cls('about')} href="{base}index.html#about">About</a>
    </nav>
    <div class="nav__actions">
      <a class="btn btn--sm btn--ghost" href="{base}index.html#join">Join the group <span class="btn__arrow">&rarr;</span></a>
      <button class="nav__toggle" type="button" aria-label="Menu" aria-expanded="false"><span></span></button>
    </div>
  </div>
  <div class="nav__drawer">
    <a href="{base}index.html#research">Research</a>
    <a href="{base}projects/index.html">Projects</a>
    <a href="{base}people/index.html">People</a>
    <a href="{base}index.html#about">About</a>
    <a href="{base}index.html#join">Join the group</a>
  </div>
</header>
"""


def footer(base):
    return f"""
<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div>
        <img class="footer__logo" src="{base}site/img/logos/CornellDuffieldEngineering_Stacked_Logo_No_Seal_White.png" alt="Cornell Duffield Engineering" />
        <p class="footer__blurb">AI for Cities (AI4C) is a research group in the Systems
          Engineering Program at Cornell Duffield Engineering, building urban AI and
          computational tools for understanding complex city systems.</p>
      </div>
      <div>
        <h4>Research</h4>
        <ul>
          <li><a href="{base}index.html#research">Themes</a></li>
          <li><a href="{base}projects/index.html">Projects</a></li>
          <li><a href="{base}projects/heatscape.html">Heatscape NYC</a></li>
          <li><a href="{URIS_URL}" target="_blank" rel="noopener">URIS Mapper</a></li>
          <li><a href="{base}index.html#about">About the project</a></li>
        </ul>
      </div>
      <div>
        <h4>People</h4>
        <ul>
          <li><a href="{base}people/index.html">Research team</a></li>
          <li><a href="{base}index.html#people">On the landing page</a></li>
          <li><a href="{base}index.html#join">Join the group</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
          <li><a href="https://www.duffield.cornell.edu/sys/">Systems Engineering</a></li>
          <li><span style="font-size:14px;color:var(--ink-3)">Carpenter Hall B1C<br />313 Campus Rd<br />Ithaca, NY 14853</span></li>
        </ul>
      </div>
    </div>
    <div class="footer__base">
      <span>&copy; <span data-year>2026</span> AI for Cities · Cornell University</span>
      <span>Systems Engineering · Cornell Duffield Engineering</span>
    </div>
  </div>
</footer>
"""


def scripts(base, globe=False):
    g = f'<script src="{base}site/js/landmask.js"></script>\n<script src="{base}site/js/vendor/three.min.js"></script>\n<script src="{base}site/js/globe.js"></script>\n' if globe else ""
    return f"""
<script src="{base}site/js/vendor/lenis.min.js"></script>
<script src="{base}site/js/vendor/gsap.min.js"></script>
<script src="{base}site/js/vendor/ScrollTrigger.min.js"></script>
{g}<script src="{base}site/js/main.js"></script>
</body>
</html>
"""


# --------------------------------------------------------------------------
# Fragments
# --------------------------------------------------------------------------

def person_card(p, base):
    return f"""      <a class="person-card glass" href="{base}people/{p['slug']}.html">
        <span class="person-card__tag">{p['role']}</span>
        <div class="person-card__photo">
          <img src="{base}site/img/people/{p['slug']}-360.jpg" alt="{p['name']}" loading="lazy" width="360" height="360" />
        </div>
        <div class="person-card__body">
          <h3>{p['name']}</h3>
          <div class="person-card__role">{p['role']}</div>
          <div class="person-card__aff">{p['affil']}</div>
          <span class="person-card__cta">View profile <span aria-hidden="true">&rarr;</span></span>
        </div>
      </a>
"""


def heatscape_card(base, featured=False):
    if featured:
        return f"""    <article class="feature glass" data-reveal>
      <div class="feature__media">
        <img src="{base}site/img/projects/heatscape-map.webp" alt="New York City on a 250-metre grid, each populated cell coloured by its best-matched cooling intervention" loading="lazy" />
      </div>
      <div class="feature__body">
        <div class="pill-row">
          <span class="pill pill--live">Live</span>
          <span class="pill">New York City</span>
          <span class="pill">Urban heat</span>
        </div>
        <h3 class="h2">Heatscape NYC</h3>
        <p class="lede">A 250-metre grid over New York City that scores every populated
          cell for heat risk across 43 indicators, then matches it to the cooling
          intervention its context actually supports — and shows the causal path it took
          to get there.</p>
        <div class="hero__actions" style="margin-top:8px">
          <a class="btn btn--primary" href="{base}projects/heatscape.html">Project overview <span class="btn__arrow">&rarr;</span></a>
          <a class="btn btn--ghost" href="{base}projects/heatscape/index.html">Open the app <span class="btn__arrow">&rarr;</span></a>
        </div>
      </div>
    </article>
"""
    return f"""      <a class="project-card glass" href="{base}projects/heatscape.html">
        <div class="project-card__media">
          <img src="{base}site/img/projects/heatscape-map.webp" alt="Heatscape NYC intervention map" loading="lazy" />
        </div>
        <div class="project-card__body">
          <div class="pill-row" style="margin-bottom:16px">
            <span class="pill pill--live">Live</span>
            <span class="pill">New York City</span>
          </div>
          <h3>Heatscape NYC</h3>
          <p>Urban heat intervention planner — 10,081 populated cells scored on 43
            indicators and matched to the cooling intervention their context supports.</p>
          <span class="link-arrow" style="margin-top:18px">Project overview <span aria-hidden="true">&rarr;</span></span>
        </div>
      </a>
"""


def urismapper_card(base, featured=False):
    """URIS Mapper lives on its own domain — every route here leaves the site."""
    if featured:
        return f"""    <article class="feature feature--reverse glass" data-reveal>
      <div class="feature__media">
        <img src="{base}site/img/projects/urismapper-cover.webp" alt="The URIS Mapper causal diagram editor, showing a system-dynamics view with feedback loop badges and the Loop Assistant panel" loading="lazy" />
      </div>
      <div class="feature__body">
        <div class="pill-row">
          <span class="pill pill--live">Live</span>
          <span class="pill">Causal loop diagrams</span>
          <span class="pill">System dynamics</span>
        </div>
        <h3 class="h2">URIS Mapper</h3>
        <p class="lede">A browser-based platform for building and interrogating causal
          loop diagrams. It finds the reinforcing and balancing loops in a map for you,
          filters the structure by subsystem, and answers questions about what is
          currently on screen.</p>
        <div class="hero__actions" style="margin-top:8px">
          <a class="btn btn--primary" href="{URIS_URL}" target="_blank" rel="noopener">Open URIS Mapper <span class="btn__arrow">&#8599;</span></a>
        </div>
      </div>
    </article>
"""
    return f"""      <a class="project-card glass" href="{URIS_URL}" target="_blank" rel="noopener">
        <div class="project-card__media">
          <img src="{base}site/img/projects/urismapper-cover.webp" alt="URIS Mapper causal diagram editor" loading="lazy" />
        </div>
        <div class="project-card__body">
          <div class="pill-row" style="margin-bottom:16px">
            <span class="pill pill--live">Live</span>
            <span class="pill">System dynamics</span>
          </div>
          <h3>URIS Mapper</h3>
          <p>A causal diagram platform — build a loop map, let it find the reinforcing
            and balancing structures, and ask what a change would propagate to.</p>
          <span class="link-arrow" style="margin-top:18px">urismapper.com <span aria-hidden="true">&#8599;</span></span>
        </div>
      </a>
"""


# --------------------------------------------------------------------------
# Home
# --------------------------------------------------------------------------

def build_home():
    base = ""
    themes = "\n".join(f"""      <article class="theme-card glass" data-glow>
        <span class="theme-card__glow" style="background:{t['color']}"></span>
        <div class="theme-card__n">{t['n']}</div>
        <h3>{t['title']}</h3>
        <p>{t['body']}</p>
        <div style="margin-top:auto;padding-top:20px">
          <a class="link-arrow" href="{base}people/{t['lead']}.html">{PEOPLE_BY_SLUG[t['lead']]['short']} <span aria-hidden="true">&rarr;</span></a>
        </div>
      </article>""" for t in THEMES)

    marquee_items = [
        "Cornell Duffield Engineering", "Systems Engineering Program",
        "Center for Transportation, Environment &amp; Community Health",
        "Global Analytics Observatory", "College of Architecture, Art, and Planning",
        "Urban digital twins", "Spatial AI &amp; reasoning",
        "Agentic geospatial intelligence", "Policy &amp; deployment",
    ]
    marquee = "".join(f'<span class="marquee__item">{m}</span>' for m in marquee_items)

    people_cards = "\n".join(person_card(p, base) for p in PEOPLE)

    body = f"""<main id="main">

  <!-- ================= HERO ================= -->
  <section class="hero">
    <div class="hero__stage">
      <canvas id="globe-canvas" aria-hidden="true"></canvas>
      <div id="globe-labels" aria-hidden="true"></div>
    </div>

    <div class="wrap hero__grid">
      <div class="hero__copy">
        <a class="hero__badge" href="projects/heatscape.html">
          <b>Live</b> Heatscape NYC — urban heat intervention planner
          <span aria-hidden="true" style="opacity:.6">&rarr;</span>
        </a>

        <h1 class="h-display hero__title">
          <span class="line"><span>AI for Cities</span></span>
          <span class="line"><span class="hero__title-sub">From urban data to <em class="serif-em">real-world impact</em></span></span>
        </h1>

        <p class="lede hero__lede">A research group at Cornell Duffield Engineering
          building intelligent, scalable and interactive models of cities — turning
          crowdsourced maps, street-level imagery, satellite data and human mobility into
          tools that researchers, planners and communities can actually use.</p>

        <div class="hero__actions">
          <a class="btn btn--primary" href="projects/index.html" data-magnetic>Explore projects <span class="btn__arrow">&rarr;</span></a>
          <a class="btn btn--ghost" href="people/index.html">Meet the team <span class="btn__arrow">&rarr;</span></a>
        </div>

        <div class="hero__stats">
          <div class="stat"><div class="stat__n"><span data-count="10081">0</span></div><div class="stat__l">populated 250&nbsp;m cells scored</div></div>
          <div class="stat"><div class="stat__n"><span data-count="43">0</span></div><div class="stat__l">urban indicators per cell</div></div>
          <div class="stat"><div class="stat__n"><span data-count="95">0</span></div><div class="stat__l">edges in the causal model</div></div>
          <div class="stat"><div class="stat__n"><span data-count="6">0</span></div><div class="stat__l">researchers, four disciplines</div></div>
        </div>
      </div>
    </div>

    <div class="globe-key" aria-hidden="true">
      <span class="globe-key__item"><span class="globe-key__dot"></span> Ithaca &rarr; partner cities</span>
      <span class="globe-key__item"><span class="globe-key__dot" style="background:#f9c74f;box-shadow:0 0 10px #f9c74f"></span> Live testbed: New York City</span>
      <span class="globe-key__item">Drag to rotate</span>
    </div>

    <div class="scroll-cue"><span>Scroll</span><i></i></div>
  </section>

  <!-- ================= MARQUEE ================= -->
  <div class="marquee"><div class="marquee__track">{marquee}</div></div>

  <!-- ================= ABOUT ================= -->
  <section class="section" id="about">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <p class="eyebrow">The project</p>
        <h2 class="h1">Cities are systems.<br />We build the tools that let
          you <em class="serif-em">reason</em> about them.</h2>
      </div>

      <div class="grid grid--2" style="gap:clamp(28px,4vw,64px);align-items:start">
        <div class="prose" data-reveal>
          <p>AI for Cities develops urban AI and computational tools for understanding
            complex city systems. We create intelligent, scalable and interactive models of
            cities that integrate heterogeneous urban data — crowdsourced data from
            OpenStreetMap, street view and satellite imagery, and human mobility flows.</p>
          <p>We use that data and AI to help researchers, planners, policymakers and other
            stakeholders explore urban conditions, identify patterns, and evaluate potential
            interventions. The broader goal is an urban intelligence ecosystem that makes
            advanced city modelling more accessible, and supports better decisions in
            transportation, housing, climate resilience and infrastructure.</p>
          <p>The group sits in the Systems Engineering Program at Cornell Duffield
            Engineering, and works across computer science, planning, design, policy,
            environmental science and the social sciences.</p>
        </div>

        <div style="display:grid;gap:22px" data-reveal>
          <blockquote class="pullquote glass">
            Where is the most heat-vulnerable area in New York City? How do building density
            and street layout affect the prevalence of non-communicable health conditions,
            such as social isolation, depression, and obesity?
            <footer>Questions AI4C is built to answer</footer>
          </blockquote>
          <dl class="deflist glass" style="border-radius:var(--r-lg)">
            <div class="deflist__row"><dt>Home</dt><dd>Systems Engineering, Cornell Duffield Engineering</dd></div>
            <div class="deflist__row"><dt>Faculty PI</dt><dd><a href="people/oliver-gao.html">Prof. H. Oliver Gao</a></dd></div>
            <div class="deflist__row"><dt>Project lead</dt><dd><a href="people/winston-yap.html">Dr. Winston Yap</a></dd></div>
            <div class="deflist__row"><dt>Contact</dt><dd><a href="mailto:{EMAIL}">{EMAIL}</a></dd></div>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <hr class="hairline" />

  <!-- ================= RESEARCH ================= -->
  <section class="section" id="research">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <p class="eyebrow">Research themes</p>
        <h2 class="h1">Four threads, one stack</h2>
        <p class="lede">Each theme is a layer of the same system: a place to represent the
          city, a way to reason over it, agents that operate it, and a route into the
          decisions that follow.</p>
      </div>
      <div class="grid grid--4" data-reveal-stagger>
{themes}
      </div>
    </div>
  </section>

  <!-- ================= PROJECTS ================= -->
  <section class="section" id="projects">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <p class="eyebrow">Projects</p>
        <h2 class="h1">What we have shipped</h2>
        <p class="lede">Research that ends in a paper is only half done. Every AI4C
          workstream is expected to produce something a planner can open.</p>
      </div>
{heatscape_card(base, featured=True)}
      <div style="margin-top:22px">
{urismapper_card(base, featured=True)}
      </div>
      <div style="margin-top:34px" data-reveal>
        <a class="link-arrow" href="projects/index.html">All projects and workstreams <span aria-hidden="true">&rarr;</span></a>
      </div>
    </div>
  </section>

  <hr class="hairline" />

  <!-- ================= PEOPLE ================= -->
  <section class="section" id="people">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <p class="eyebrow">People</p>
        <h2 class="h1">The group</h2>
        <p class="lede">One research team spanning systems engineering, computer science,
          city planning and real estate. Each profile links through to the work behind it.</p>
      </div>
      <div class="grid grid--3" data-reveal-stagger>
{people_cards}
      </div>
      <div style="margin-top:34px" data-reveal>
        <a class="link-arrow" href="people/index.html">Full team page <span aria-hidden="true">&rarr;</span></a>
      </div>
    </div>
  </section>

  <!-- ================= JOIN ================= -->
  <section class="section section--tight" id="join">
    <div class="wrap">
      <div class="cta-band glass" data-reveal>
        <p class="eyebrow" style="justify-content:center">Join us</p>
        <h2 class="h2">Everyone interested in cities is welcome</h2>
        <p class="lede">The project is deliberately broad: AI modelling, geospatial
          analysis, 3D visualisation, LLM development, scalable systems architecture,
          human-centred design, community and stakeholder engagement, policy and
          evaluation, ethnographic research, and the conceptual work of describing how
          urban technologies are actually understood and used.</p>
        <p class="lede" style="margin-top:14px">Students with design and social-science
          backgrounds are particularly encouraged, and can contribute through UI/UX research
          and design, user surveys, usability testing, participatory workshops, interviews
          and focus groups.</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="mailto:{EMAIL}?subject=AI%20for%20Cities%20—%20interest" data-magnetic>Email the project lead <span class="btn__arrow">&rarr;</span></a>
          <a class="btn btn--ghost" href="#research">See the research themes</a>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    return head(f"{SITE_NAME} — {TAGLINE}",
                "AI for Cities (AI4C) is a research group at Cornell Duffield Engineering "
                "building urban AI and computational tools for understanding complex city systems.",
                base) + nav(base, "") + body + footer(base) + scripts(base, globe=True)


# --------------------------------------------------------------------------
# People index
# --------------------------------------------------------------------------

def build_people_index():
    base = "../"
    groups = [("team", "Research Team",
               "One group, no tiers. Faculty, postdoctoral and student researchers work "
               "the same problems from different disciplines, and each person owns a piece "
               "of the work.")]
    sections = []
    for key, label, blurb in groups:
        cards = "\n".join(person_card(p, base) for p in PEOPLE if p["group"] == key)
        sections.append(f"""  <section class="section section--tight">
    <div class="wrap">
      <div class="section-head" data-reveal style="margin-bottom:38px">
        <p class="eyebrow">{label}</p>
        <p class="lede" style="margin-top:0">{blurb}</p>
      </div>
      <div class="grid grid--fill" data-reveal-stagger>
{cards}
      </div>
    </div>
  </section>""")

    body = f"""<main id="main">
  <section class="pagehead">
    <div class="wrap">
      <div class="crumbs"><a href="{base}index.html">AI for Cities</a><span>/</span>People</div>
      <h1 class="h-display" style="font-size:clamp(2.6rem,6.6vw,4.6rem)">People</h1>
      <p class="lede" style="max-width:660px;margin-top:22px">Six researchers across systems
        engineering, computer science, city planning and real estate — one team, each
        person linked to the projects they work on.</p>
    </div>
  </section>

{chr(10).join(sections)}

  <section class="section section--tight">
    <div class="wrap">
      <div class="cta-band glass" data-reveal>
        <h2 class="h2">Want to work on this?</h2>
        <p class="lede">AI4C recruits research assistants across AI, geospatial modelling,
          design, policy and the social sciences.</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="mailto:{EMAIL}?subject=AI%20for%20Cities%20—%20interest" data-magnetic>Get in touch <span class="btn__arrow">&rarr;</span></a>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    return head(f"People — {SITE_NAME}",
                "The AI for Cities research group: faculty lead, project lead, faculty "
                "advisory board and student workstream leads.",
                base) + nav(base, "people") + body + footer(base) + scripts(base)


# --------------------------------------------------------------------------
# Person page
# --------------------------------------------------------------------------

def build_person(p, prev_p, next_p):
    base = "../"
    role_cls = ""   # one tier — every role badge reads the same

    bio = "\n".join(f"          <p>{para}</p>" for para in p["bio"])
    quote = ""
    if p.get("quote"):
        quote = f"""
        <blockquote class="pullquote glass" style="margin-top:34px">
          &ldquo;{p['quote']}&rdquo;
          <footer>{p['name']}, in his own words</footer>
        </blockquote>"""

    focus = "".join(f'<span class="pill">{f}</span>' for f in p["focus"])
    meta = "\n".join(
        f'            <div class="deflist__row"><dt>{k}</dt><dd>{v}</dd></div>'
        for k, v in p["meta"])
    links = ""
    if p["links"]:
        items = "".join(
            f'<a class="btn btn--sm btn--ghost" href="{u}" target="_blank" rel="noopener">{t} <span class="btn__arrow">&#8599;</span></a>'
            for t, u in p["links"])
        links = f'<div class="pill-row" style="gap:10px;margin-top:26px">{items}</div>'

    prev_html = (f"""<a href="{prev_p['slug']}.html"><small>Previous</small><b>{prev_p['name']}</b></a>"""
                 if prev_p else "<span></span>")
    next_html = (f"""<a class="is-right" href="{next_p['slug']}.html"><small>Next</small><b>{next_p['name']}</b></a>"""
                 if next_p else "<span></span>")

    body = f"""<main id="main">
  <section class="pagehead">
    <div class="wrap">
      <div class="crumbs">
        <a href="{base}index.html">AI for Cities</a><span>/</span>
        <a href="{base}people/index.html">People</a><span>/</span>{p['name']}
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="profile">
        <aside class="profile__aside">
          <div class="profile__photo glass">
            <img src="{base}site/img/people/{p['slug']}-720.jpg" alt="{p['name']}" width="720" height="720" />
          </div>
          <dl class="deflist glass" style="border-radius:var(--r-lg)">
{meta}
          </dl>
        </aside>

        <div>
          <p class="eyebrow">{p['group_label']}</p>
          <h1 class="h1 profile__name">{p['name']}</h1>
          <span class="profile__role{role_cls}">{p['role']}</span>
          <p class="lede" style="margin-bottom:30px">{p['affil']}<br />
            <span style="color:var(--ink-3)">{p['affil2']}</span></p>

          <div class="prose">
{bio}
          </div>
{quote}
          {links}

          <h3 class="h3" style="margin-top:52px;margin-bottom:18px">Focus areas</h3>
          <div class="pill-row">{focus}</div>

          <h3 class="h3" style="margin-top:52px;margin-bottom:20px">Projects</h3>
          <div class="grid grid--2">
{heatscape_card(base)}
{urismapper_card(base)}
          </div>

          <nav class="peer-nav" aria-label="Other team members">
            {prev_html}
            {next_html}
          </nav>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    desc = f"{p['name']} — {p['role']}, AI for Cities, {p['affil']}."
    return head(f"{p['name']} — {SITE_NAME}", html.escape(desc, quote=True), base) \
        + nav(base, "people") + body + footer(base) + scripts(base)


# --------------------------------------------------------------------------
# Projects index
# --------------------------------------------------------------------------

def build_projects_index():
    base = "../"
    workstreams = "\n".join(f"""      <article class="theme-card glass" data-glow>
        <span class="theme-card__glow" style="background:{t['color']}"></span>
        <div class="pill-row" style="margin-bottom:22px"><span class="pill pill--soon">In development</span></div>
        <h3>{t['title']}</h3>
        <p>{t['body']}</p>
        <div style="margin-top:auto;padding-top:20px">
          <a class="link-arrow" href="{base}people/{t['lead']}.html">Lead: {PEOPLE_BY_SLUG[t['lead']]['short']} <span aria-hidden="true">&rarr;</span></a>
        </div>
      </article>""" for t in THEMES)

    body = f"""<main id="main">
  <section class="pagehead">
    <div class="wrap">
      <div class="crumbs"><a href="{base}index.html">AI for Cities</a><span>/</span>Projects</div>
      <h1 class="h-display" style="font-size:clamp(2.6rem,6.6vw,4.6rem)">Projects</h1>
      <p class="lede" style="max-width:660px;margin-top:22px">Applications, datasets and
        models built by the group. Each one is meant to be opened, not just cited.</p>
    </div>
  </section>

  <section class="section section--tight" style="padding-top:20px">
    <div class="wrap" style="display:grid;gap:22px">
{heatscape_card(base, featured=True)}
{urismapper_card(base, featured=True)}
    </div>
  </section>

  <hr class="hairline" />

  <section class="section">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <p class="eyebrow">Workstreams</p>
        <h2 class="h1">In development</h2>
        <p class="lede">Four threads run in parallel underneath the shipped work. Each has a
          named lead and is where new projects come from.</p>
      </div>
      <div class="grid grid--4" data-reveal-stagger>
{workstreams}
      </div>
    </div>
  </section>

  <section class="section section--tight">
    <div class="wrap">
      <div class="cta-band glass" data-reveal>
        <h2 class="h2">Build the next one</h2>
        <p class="lede">Depending on interest, milestones can include developing your own
          app or AI project, presenting it to stakeholders, releasing a code package or
          dataset, or publishing.</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="mailto:{EMAIL}?subject=AI%20for%20Cities%20—%20project%20interest" data-magnetic>Pitch a project <span class="btn__arrow">&rarr;</span></a>
          <a class="btn btn--ghost" href="{base}people/index.html">Meet the team</a>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    return head(f"Projects — {SITE_NAME}",
                "Applications, datasets and models built by AI for Cities, including "
                "Heatscape NYC.", base) + nav(base, "projects") + body + footer(base) + scripts(base)


# --------------------------------------------------------------------------
# Heatscape project page
# --------------------------------------------------------------------------

def build_heatscape():
    base = "../"
    legend = "\n".join(
        f'        <div class="legend__row"><span class="legend__sw" style="background:{c};color:{c}"></span>'
        f'<span><strong style="color:var(--ink-0);font-weight:500">{n}</strong> — {d}</span></div>'
        for c, n, d in INTERVENTIONS)

    contributors = "\n".join(person_card(PEOPLE_BY_SLUG[s], base)
                             for s in ["winston-yap", "oliver-gao", "charlle-sy",
                                       "suzanne-charles", "krishiv-vora", "andrew-wu"])

    body = f"""<main id="main">
  <section class="pagehead">
    <div class="wrap">
      <div class="crumbs">
        <a href="{base}index.html">AI for Cities</a><span>/</span>
        <a href="{base}projects/index.html">Projects</a><span>/</span>Heatscape NYC
      </div>
      <div class="pill-row" style="margin-bottom:22px">
        <span class="pill pill--live">Live</span>
        <span class="pill">New York City</span>
        <span class="pill">Urban heat</span>
        <span class="pill">Causal modelling</span>
      </div>
      <h1 class="h-display" style="font-size:clamp(2.6rem,7vw,5rem)">Heatscape NYC</h1>
      <p class="lede" style="max-width:720px;margin-top:24px">An urban heat intervention
        planner. It maps a 250&nbsp;m × 250&nbsp;m grid over New York City and recommends,
        for every populated cell, the cooling intervention best matched to its context —
        derived from a causal systems diagram and a stack of geospatial layers.</p>
      <div class="hero__actions" style="margin-top:32px">
        <a class="btn btn--primary" href="heatscape/index.html" data-magnetic>Open the live app <span class="btn__arrow">&rarr;</span></a>
        <a class="btn btn--ghost" href="#method">How it works</a>
      </div>
    </div>
  </section>

  <section class="section section--tight" style="padding-top:24px">
    <div class="wrap">
      <div class="glass" data-reveal style="padding:clamp(18px,2.5vw,30px)">
        <img src="{base}site/img/projects/heatscape-map.webp"
             alt="Every populated 250-metre cell in New York City, coloured by its top-ranked cooling intervention"
             style="width:100%;border-radius:var(--r-md)" loading="lazy" />
        <p class="mono-tag" style="margin-top:18px">Top-ranked intervention per populated cell · 10,081 cells · equal-weight basis</p>
      </div>

      <div class="hero__stats" style="max-width:none;margin-top:26px" data-reveal>
        <div class="stat"><div class="stat__n"><span data-count="10081">0</span></div><div class="stat__l">populated cells scored</div></div>
        <div class="stat"><div class="stat__n"><span data-count="43">0</span></div><div class="stat__l">indicators per cell</div></div>
        <div class="stat"><div class="stat__n"><span data-count="52">0</span></div><div class="stat__l">nodes in the systems diagram</div></div>
        <div class="stat"><div class="stat__n"><span data-count="95">0</span></div><div class="stat__l">causal edges</div></div>
        <div class="stat"><div class="stat__n">250<small>m</small></div><div class="stat__l">grid resolution</div></div>
      </div>
    </div>
  </section>

  <hr class="hairline" />

  <section class="section">
    <div class="wrap">
      <div class="grid grid--2" style="gap:clamp(28px,4vw,64px);align-items:start">
        <div data-reveal>
          <p class="eyebrow">What you can do</p>
          <div class="prose">
            <ul>
              <li><strong>Priority score layer</strong> — composite risk from nine indicator
                categories, gated by residential population: no residents, no priority.</li>
              <li><strong>Top intervention layer</strong> — every cell coloured by the
                cooling measure its context best supports.</li>
              <li><strong>Category risk layers</strong> — any single category as a
                choropleth.</li>
              <li><strong>Click a cell</strong> — its neighbourhood, priority, ranked
                interventions and all 43 indicators, each with a percentile bar against the
                rest of the city.</li>
              <li><strong>Tune the weights</strong> — sliders for every category and every
                variable inside it; the map, scores and intervention ranking update live.</li>
              <li><strong>Switch the weighting basis</strong> — Shapley attribution or equal
                weighting, with the disagreement between them made visible.</li>
              <li><strong>Systems diagram</strong> — selecting a cell lights up every causal
                node it activates and animates the flow toward heat emergency.</li>
            </ul>
          </div>
        </div>

        <div class="glass" style="padding:clamp(26px,3vw,36px)" data-reveal>
          <p class="eyebrow">Interventions ranked</p>
          <div class="legend" style="margin-top:6px">
{legend}
          </div>
          <p style="margin-top:24px;font-size:13.5px;color:var(--ink-3)">Each cell's ranking
            is a weighted mean of directional risk percentiles across that intervention's
            factor set, gated by residential population.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="method">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <p class="eyebrow">Method</p>
        <h2 class="h1">Weights you can argue with</h2>
      </div>

      <div class="grid grid--2" style="gap:clamp(28px,4vw,64px);align-items:start">
        <div class="prose" data-reveal>
          <p>Equal weighting encodes an assumption it cannot check: that every indicator
            matters as much as every other. Heatscape's default replaces that with an
            attribution. A fitted structural causal model decomposes the explained variance
            in heat-emergency incidence into each indicator's average marginal contribution
            across coalition orderings — its <strong>Shapley share</strong> — and those
            shares drive the sliders.</p>
          <p>Shares are normalised <em>within</em> a category rather than globally. The
            decomposition is lopsided: four indicators carry roughly three quarters of the
            total attribution and eighteen of the forty-three receive none at all. A single
            global normalisation would pin most sliders to zero and destroy the ordering
            inside every group.</p>
          <p>Against equal weighting, the Shapley basis changes the score of 96% of
            populated cells and replaces 45% of the top-decile priority cells.</p>

          <h3>Three things the interface says out loud</h3>
          <ul>
            <li><strong>Nothing is shrunk.</strong> A Shapley share is an attribution, not
              an effect estimate — there is no reliability term to shrink it toward one.</li>
            <li><strong>Direction never comes from this basis.</strong> A Shapley share is
              unsigned; every indicator keeps the polarity declared in the systems diagram.
              Only magnitude changes.</li>
            <li><strong>Two categories fall out entirely.</strong> Physiological
              vulnerability and behavioural measures arrive as tract-level rates that barely
              vary between 250&nbsp;m cells, so there is little for the model to attribute.
              That is a resolution artefact, not a finding that health burden is
              irrelevant.</li>
          </ul>
        </div>

        <div style="display:grid;gap:22px" data-reveal>
          <div class="glass" style="padding:clamp(18px,2.4vw,26px)">
            <img src="{base}site/img/projects/heatscape-heat.webp"
                 alt="Heat exposure percentile across New York City's populated cells"
                 style="width:100%;border-radius:var(--r-md)" loading="lazy" />
            <p class="mono-tag" style="margin-top:16px">Heat exposure percentile · surface temperature deviation</p>
          </div>

          <dl class="deflist glass" style="border-radius:var(--r-lg)">
            <div class="deflist__row"><dt>Grid</dt><dd>250&nbsp;m UTM-18N cells clipped to the NYC hull</dd></div>
            <div class="deflist__row"><dt>Population gate</dt><dd>Cells with fewer than 10 residents are excluded from scoring</dd></div>
            <div class="deflist__row"><dt>Health &amp; social data</dt><dd>CDC PLACES tract prevalence and ACS socioeconomics, dasymetrically rasterised onto 30&nbsp;m population points</dd></div>
            <div class="deflist__row"><dt>Canopy</dt><dd>1&nbsp;m canopy height model, aggregated to mean height and % cover ≥ 3&nbsp;m</dd></div>
            <div class="deflist__row"><dt>Mobility</dt><dd>Length-weighted mean predicted pedestrian volume per street metre</dd></div>
            <div class="deflist__row"><dt>Stack</dt><dd>Static site — MapLibre GL, no build step, no server dependency</dd></div>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <hr class="hairline" />

  <section class="section">
    <div class="wrap">
      <div class="section-head" data-reveal>
        <p class="eyebrow">Team</p>
        <h2 class="h1">Who built it</h2>
        <p class="lede">Heatscape was built inside AI4C and is the reference
          implementation the group's other workstreams build against.</p>
      </div>
      <div class="grid grid--3" data-reveal-stagger>
{contributors}
      </div>
    </div>
  </section>

  <section class="section section--tight">
    <div class="wrap">
      <div class="cta-band glass" data-reveal>
        <h2 class="h2">Open Heatscape NYC</h2>
        <p class="lede">Pick a cell, read its 43 indicators, move the weights, and watch the
          causal diagram light up behind the recommendation.</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="heatscape/index.html" data-magnetic>Launch the app <span class="btn__arrow">&rarr;</span></a>
          <a class="btn btn--ghost" href="{base}projects/index.html">All projects</a>
        </div>
      </div>
    </div>
  </section>
</main>
"""
    return head(f"Heatscape NYC — {SITE_NAME}",
                "Heatscape NYC maps a 250 m grid over New York City and recommends the "
                "cooling intervention best matched to each populated cell's context.",
                base) + nav(base, "projects") + body + footer(base) + scripts(base)


# --------------------------------------------------------------------------

def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", path, len(content))


if __name__ == "__main__":
    write("index.html", build_home())
    write("people/index.html", build_people_index())
    for i, p in enumerate(PEOPLE):
        write(f"people/{p['slug']}.html",
              build_person(p, PEOPLE[i - 1] if i > 0 else None,
                           PEOPLE[i + 1] if i < len(PEOPLE) - 1 else None))
    write("projects/index.html", build_projects_index())
    write("projects/heatscape.html", build_heatscape())
