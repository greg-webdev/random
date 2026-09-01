document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const jsonInput = document.getElementById('json-input');
    const htmlOutput = document.getElementById('html-output');
    const generateBtn = document.getElementById('generate-btn');
    const formatBtn = document.getElementById('format-json-btn');
    const clearBtn = document.getElementById('clear-json-btn');
    const templateSelect = document.getElementById('template-select');
    const fontUploadInput = document.getElementById('font-upload');
    const activeFontBadge = document.getElementById('active-font-badge');
    const fontNameDisplay = document.getElementById('font-name-display');
    const removeFontBtn = document.getElementById('remove-font-btn');
    const previewFrame = document.getElementById('preview-frame');
    const previewContainer = document.getElementById('preview-container');
    const copyHtmlBtn = document.getElementById('copy-html-btn');
    const downloadBtn = document.getElementById('download-btn');
    const openNewTabBtn = document.getElementById('open-new-tab-btn');
    const errorBanner = document.getElementById('error-banner');
    const errorMessage = document.getElementById('error-message');
    const jsonStatus = document.getElementById('json-status');
    const jsonCharCount = document.getElementById('json-char-count');
    const htmlSizeBadge = document.getElementById('html-size-badge');
    const outputMeta = document.getElementById('output-meta');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Tab buttons & contents
    const tabPreviewBtn = document.getElementById('tab-preview-btn');
    const tabCodeBtn = document.getElementById('tab-code-btn');
    const tabPreview = document.getElementById('tab-preview');
    const tabCode = document.getElementById('tab-code');

    // Viewport switcher buttons
    const viewportBtns = document.querySelectorAll('.viewport-btn');

    let currentGeneratedHtml = '';
    let customFontState = null; // { name, dataUrl, format }

    // Predefined Templates (No emojis, branded with gbuild)
    const templates = {
        // Master Template containing EVERY supported UI element and section
        all: {
            title: "Ultimate Web Elements Showcase | gbuild",
            theme: "modern-dark",
            navbar: {
                brand: "gbuild",
                links: ["Features", "Metrics", "Skills", "Projects", "Product", "Blog", "Activity", "FAQ", "Contact"],
                cta: "Get Started"
            },
            hero: {
                badge: "Complete Web Elements Showcase v3.5",
                heading: "Build Any Web Interface Directly From Structured JSON",
                subheading: "Explore every section supported by the engine: heroes, stat metrics, feature grids, skill chips, case studies, product cards, article layouts, data tables, interactive FAQs, and contact sections.",
                primaryCta: "Explore Components",
                secondaryCta: "View HTML Code"
            },
            metrics: [
                { label: "Active Deployments", value: "250K+", change: "+24.8%", trend: "up" },
                { label: "Total Page Views", value: "48.2M", change: "+14.2%", trend: "up" },
                { label: "Uptime Reliability", value: "99.99%", change: "+0.01%", trend: "up" },
                { label: "Avg Compilation Speed", value: "12 ms", change: "-40.0%", trend: "up" }
            ],
            skills: [
                "HTML5 Semantic", "Vanilla CSS3", "Modern JavaScript", "Flexbox & Grid", "Web Components", "JSON Schema", "Responsive Design", "Dark Mode", "Micro-Animations", "SEO Optimized"
            ],
            features: [
                {
                    title: "Zero-Latency Compilation",
                    description: "Compiles JSON datasets into standalone, production-ready HTML5 documents in milliseconds."
                },
                {
                    title: "Universal Responsive Layouts",
                    description: "Every generated section is 100% mobile-ready with adaptive CSS Grid and Flexbox mechanics."
                },
                {
                    title: "Curated Modern Aesthetics",
                    description: "Built-in typography, sleek gradients, glassmorphism, and accessible high-contrast color palettes."
                }
            ],
            projects: [
                {
                    title: "CloudPulse Telemetry Dashboard",
                    category: "Infrastructure & DevOps",
                    description: "Real-time distributed telemetry engine processing 50,000 events/sec with sub-50ms latency dashboards.",
                    tags: ["TypeScript", "WebSockets", "Docker", "TimescaleDB"],
                    link: "#"
                },
                {
                    title: "NeuralCanvas Visual Editor",
                    category: "Generative AI Tooling",
                    description: "Interactive visual workspace combining vector pipelines with real-time prompt generation engines.",
                    tags: ["JavaScript", "WebGL", "CSS Grid", "REST API"],
                    link: "#"
                }
            ],
            product: {
                name: "AeroPro Sonic Master X",
                tagline: "Studio Fidelity. Adaptive Spatial Audio.",
                price: "$349.00",
                originalPrice: "$429.00",
                rating: "4.9 / 5.0 (1,420 Reviews)",
                badge: "20% OFF Limited Time",
                description: "Immerse yourself in pure studio-grade acoustics. Powered by custom 45mm titanium dynamic drivers and 40-hour hybrid active noise cancellation.",
                highlights: [
                    "40 Hours Continuous Battery Life",
                    "Custom 45mm Titanium Dynamic Drivers",
                    "Triple Microphone Array with Wind Isolation",
                    "Ultra-Soft Memory Foam Ear Cushions",
                    "Multipoint Bluetooth 5.4 Connectivity"
                ],
                specs: {
                    "Driver Size": "45mm Titanium",
                    "Frequency Range": "10Hz - 45,000Hz",
                    "Weight": "248g Lightweight Alloy",
                    "Charging": "USB-C Fast Charge (10 min = 5h Play)",
                    "Warranty": "2-Year Complete Replacement"
                },
                cta: "Add To Cart - $349.00"
            },
            article: {
                category: "Engineering Architecture",
                publishedAt: "September 2026",
                readTime: "5 min read",
                author: {
                    name: "Dr. Sarah Jenkins",
                    role: "Principal Systems Architect"
                },
                heading: "Building Scalable Web Applications from Pure JSON Schemas",
                lead: "Declarative component composition allows teams to eliminate repetitive UI boilerplate while guaranteeing responsive design consistency across entire web ecosystems.",
                sections: [
                    {
                        subtitle: "1. Declarative Layouts vs Manual Markup",
                        content: "When UI structure is expressed as pure data, generating clean HTML, applying dynamic style tokens, and automating multi-viewport previews becomes trivial and reliable."
                    },
                    {
                        subtitle: "2. The Power of Standalone Artifacts",
                        content: "Generating self-contained HTML files with embedded styling eliminates runtime asset dependencies, ensuring lightning-fast load times and bulletproof portability."
                    }
                ]
            },
            recentActivity: [
                { id: "TX-1001", user: "Acme Corporation", plan: "Enterprise Tier", status: "Active", amount: "$4,800" },
                { id: "TX-1002", user: "DevStudio Labs", plan: "Pro Team", status: "Active", amount: "$750" },
                { id: "TX-1003", user: "BioTech Dynamics", plan: "Dedicated Cloud", status: "Pending", amount: "$8,900" },
                { id: "TX-1004", user: "Nexus Gaming Corp", plan: "Starter Cluster", status: "Active", amount: "$290" }
            ],
            testimonials: [
                {
                    quote: "gbuild transformed our prototyping speed. We now generate production-ready HTML pages directly from our API specs in seconds.",
                    author: "Elena Rostova",
                    role: "VP of Product at TechVanguard"
                },
                {
                    quote: "The cleanest standalone output we have ever seen. No bloated node_modules or dependencies required.",
                    author: "Marcus Chen",
                    role: "Chief Architect at DataSync"
                }
            ],
            faq: [
                {
                    question: "How does the JSON to HTML generation work?",
                    answer: "The engine parses your JSON structure and maps both semantic component keys (hero, navbar, features, pricing, etc.) and custom DOM nodes into valid, standalone HTML5 with embedded responsive CSS."
                },
                {
                    question: "Can I copy or download the generated HTML code?",
                    answer: "Yes. Switch to the 'HTML Code Output' tab to inspect the raw markup, use 'Copy HTML' for clipboard export, or click 'Download .html' to save a standalone web page file."
                },
                {
                    question: "Does it support custom DOM node hierarchies?",
                    answer: "Yes. You can define explicit HTML trees using { tag: 'div', classes: '...', style: '...', children: [...] } for full granular control."
                }
            ],
            ctaBanner: {
                headline: "Ready to Accelerate Your Web Development?",
                description: "Start generating clean, modern, responsive websites directly from data structures in seconds.",
                primaryButton: "Start Building Free",
                secondaryButton: "Read the Docs"
            },
            contact: {
                headline: "Get in Touch with Our Team",
                description: "Have questions or need custom enterprise integrations? Reach out anytime.",
                email: "support@gbuild.io",
                phone: "+1 (800) 555-0199",
                location: "San Francisco, CA and Remote Worldwide"
            },
            customProperties: {
                "Environment": "Production Ready",
                "Rendering Mode": "Zero-Dependency Standalone HTML5",
                "Supported Viewports": "Mobile (375px), Tablet (768px), Desktop (100%)",
                "Licensing": "Open Source / MIT"
            },
            footer: {
                copyright: "Copyright 2026 gbuild. All rights reserved.",
                links: ["Privacy Policy", "Terms of Service", "Documentation", "GitHub", "Status"]
            }
        },

        landing: {
            title: "NextFlow - AI Workflow Automation",
            theme: "modern-dark",
            navbar: {
                brand: "NextFlow",
                links: ["Features", "Solutions", "Pricing", "Docs"],
                cta: "Start Free Trial"
            },
            hero: {
                badge: "Version 3.0 Released",
                heading: "Supercharge Your Workflows With AI Agents",
                subheading: "Automate complex business pipelines in minutes without writing boilerplate code. Deploy anywhere with 99.99% uptime.",
                primaryCta: "Get Started Free",
                secondaryCta: "Watch Demo"
            },
            metrics: [
                { label: "Active Developers", value: "140K+" },
                { label: "Pipelines Executed", value: "1.2B" },
                { label: "Average Time Saved", value: "85%" },
                { label: "Customer Rating", value: "4.9 / 5.0" }
            ],
            features: [
                {
                    title: "Instant Multi-Agent Execution",
                    description: "Distribute tasks across intelligent specialized models with automatic fallback and state persistence."
                },
                {
                    title: "Enterprise Grade Security",
                    description: "End-to-end encryption, SOC2 Type II compliant, with self-hosted private cloud deployment options."
                },
                {
                    title: "One-Click Deployments",
                    description: "Push changes directly to your production cluster or edge nodes with zero downtime."
                }
            ],
            testimonials: [
                {
                    quote: "NextFlow cut our engineering orchestration cycle from 3 weeks to 2 hours. Simply irreplaceable.",
                    author: "Elena Rostova",
                    role: "VP of Engineering at TechVanguard"
                },
                {
                    quote: "The cleanest developer experience we have ever had with an automated pipeline.",
                    author: "Marcus Chen",
                    role: "Chief Architect at DataSync"
                }
            ],
            footer: {
                copyright: "Copyright 2026 NextFlow Inc. All rights reserved.",
                links: ["Privacy Policy", "Terms of Service", "Status", "Contact"]
            }
        },

        portfolio: {
            title: "Alex Morgan | Senior Full-Stack Engineer & Architect",
            theme: "sleek-dark",
            navbar: {
                brand: "Alex Morgan",
                links: ["About", "Projects", "Skills", "Contact"],
                cta: "Download Resume"
            },
            hero: {
                badge: "Available for High-Impact Roles",
                heading: "Crafting High-Performance Distributed Systems & Delightful UIs",
                subheading: "Staff Software Engineer with 8+ years building scalable cloud backends, developer tooling, and modern web apps.",
                primaryCta: "View Projects",
                secondaryCta: "Contact Me"
            },
            skills: [
                "TypeScript", "React", "Next.js", "Node.js", "Go", "Python", "Kubernetes", "GraphQL", "PostgreSQL", "TailwindCSS", "Distributed Systems"
            ],
            projects: [
                {
                    title: "CloudPulse Monitoring",
                    category: "Cloud Infrastructure",
                    description: "Real-time distributed telemetry engine processing 50,000 events/sec with sub-50ms latency dashboards.",
                    tags: ["Go", "React", "TimescaleDB", "Docker"],
                    link: "#"
                },
                {
                    title: "NeuralCanvas Studio",
                    category: "Creative AI Tooling",
                    description: "Interactive visual workspace combining diffusion models with vector illustration pipelines.",
                    tags: ["TypeScript", "WebGL", "Python", "FastAPI"],
                    link: "#"
                },
                {
                    title: "FastCache Engine",
                    category: "High-Performance Storage",
                    description: "Zero-allocation in-memory caching layer with automatic LRU compression and Raft consensus.",
                    tags: ["Rust", "C++", "gRPC"],
                    link: "#"
                }
            ],
            footer: {
                copyright: "Built by Alex Morgan",
                links: ["GitHub", "LinkedIn", "Twitter", "Blog"]
            }
        },

        product: {
            title: "AeroPro Wireless Noise-Cancelling Headphones",
            theme: "minimal-light",
            product: {
                name: "AeroPro Sonic Master X",
                tagline: "Studio Fidelity. Adaptive Spatial Audio.",
                price: "$349.00",
                originalPrice: "$429.00",
                rating: "4.9 / 5.0 (1,420 Reviews)",
                badge: "20% OFF Summer Sale",
                description: "Immerse yourself in pure studio-grade acoustics. Powered by custom 45mm titanium drivers and 40-hour hybrid active noise cancellation.",
                highlights: [
                    "40 Hours Continuous Battery Life",
                    "Custom 45mm Titanium Dynamic Drivers",
                    "Triple Microphone Array with Wind Reduction",
                    "Ultra-Soft Memory Foam Ear Cushions",
                    "Multipoint Bluetooth 5.4 Connectivity"
                ],
                specs: {
                    "Driver Size": "45mm Titanium",
                    "Frequency Response": "10Hz - 45,000Hz",
                    "Weight": "248g",
                    "Charging Port": "USB-C Fast Charging (10m = 5h playback)",
                    "Warranty": "2-Year Manufacturer Replacement"
                },
                cta: "Add To Cart - $349.00"
            },
            footer: {
                copyright: "Copyright 2026 AeroSound Technologies.",
                links: ["Shipping Info", "Warranty", "Support"]
            }
        },

        dashboard: {
            title: "CloudMetrics Analytics Dashboard",
            theme: "dashboard-dark",
            header: {
                title: "Executive Overview",
                subtitle: "Real-time platform metrics and transaction throughput"
            },
            stats: [
                { title: "Total Monthly Revenue", value: "$128,450", change: "+18.2%", trend: "up" },
                { title: "Active API Consumers", value: "24,890", change: "+8.4%", trend: "up" },
                { title: "Avg Server Latency", value: "32 ms", change: "-12.5%", trend: "up" },
                { title: "System Uptime", value: "99.98%", change: "+0.02%", trend: "up" }
            ],
            recentActivity: [
                { id: "TX-9021", user: "Acme Corp", plan: "Enterprise Tier", status: "Active", amount: "$2,400" },
                { id: "TX-9022", user: "DevStudio Labs", plan: "Pro Team", status: "Active", amount: "$450" },
                { id: "TX-9023", user: "BioTech AI", plan: "Enterprise Dedicated", status: "Pending", amount: "$5,800" },
                { id: "TX-9024", user: "Nexus Gaming", plan: "Starter Cluster", status: "Active", amount: "$180" }
            ],
            footer: {
                copyright: "CloudMetrics Monitoring Platform v4.2"
            }
        },

        blog: {
            title: "Building Scalable AI Architectures with Micro-Frontends",
            theme: "editorial",
            article: {
                category: "Engineering & Architecture",
                publishedAt: "August 2026",
                readTime: "6 min read",
                author: {
                    name: "Dr. Sarah Jenkins",
                    role: "Chief AI Architect"
                },
                heading: "Building Scalable AI Architectures with Micro-Frontends",
                lead: "As machine learning workflows become increasingly specialized, monolith frontend applications struggle to keep pace. Discover how modular micro-frontends enable teams to ship autonomous AI widgets independently.",
                sections: [
                    {
                        subtitle: "1. The Monolith Bottleneck in Modern AI Apps",
                        content: "Modern AI web applications are not just static pages; they require real-time WebSockets, streaming LLM token rendering, dynamic canvas visualizers, and heavy client-side vector calculations. Decoupling these modules gives individual teams isolation and fault tolerance."
                    },
                    {
                        subtitle: "2. Composable Module Federation",
                        content: "Using Webpack 5 or Vite Module Federation, core layout shells can dynamically import LLM chat streams, visualization charts, and prompt managers at runtime without bundling them together."
                    },
                    {
                        subtitle: "3. Best Practices for Zero-Latency Token Streaming",
                        content: "Always utilize ReadableStream with server-sent events (SSE) and debounced RAF (requestAnimationFrame) batching to ensure 60fps buttery smooth UI rendering even under massive token throughput."
                    }
                ]
            },
            footer: {
                copyright: "Copyright 2026 TechInsights Journal",
                links: ["Subscribe", "Archive", "RSS Feed"]
            }
        },

        domtree: {
            tag: "div",
            classes: "custom-landing-wrapper",
            children: [
                {
                    tag: "header",
                    classes: "hero-section",
                    children: [
                        { tag: "span", classes: "badge", text: "DOM Component Tree" },
                        { tag: "h1", text: "Built from Pure Node Tree JSON" },
                        { tag: "p", text: "You can define arbitrary HTML hierarchies with tags, classes, styles, attributes, and children." }
                    ]
                },
                {
                    tag: "section",
                    classes: "cards-grid",
                    children: [
                        {
                            tag: "div",
                            classes: "feature-box",
                            children: [
                                { tag: "h3", text: "Node 1: Dynamic Attributes" },
                                { tag: "p", text: "Supports custom IDs, data attributes, inline styles, and semantic elements." }
                            ]
                        },
                        {
                            tag: "div",
                            classes: "feature-box",
                            children: [
                                { tag: "h3", text: "Node 2: Recursive Rendering" },
                                { tag: "p", text: "Nested children of any depth are cleanly rendered with valid HTML formatting." }
                            ]
                        }
                    ]
                }
            ]
        },

        custom: {
            siteTitle: "My Custom Web Page",
            headline: "Welcome to My Project",
            subheadline: "A fast, flexible, and responsive website generated directly from JSON data.",
            items: [
                { name: "Step 1: Define Your Data", detail: "Write clean JSON structures describing your content or components." },
                { name: "Step 2: Instant Compilation", detail: "Click Generate HTML to see both live preview and clean markup code." },
                { name: "Step 3: Export & Deploy", detail: "Copy the HTML code or download the standalone file with 1 click." }
            ]
        }
    };

    /**
     * Show floating toast notification (no emojis)
     */
    function showToast(msg) {
        toastMessage.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    /**
     * Clear error state
     */
    function clearErrors() {
        errorBanner.classList.remove('show');
        errorMessage.textContent = '';
        jsonStatus.textContent = 'Valid JSON';
        jsonStatus.className = 'badge badge-success';
    }

    /**
     * Display error banner
     */
    function displayError(msg) {
        errorBanner.classList.add('show');
        errorMessage.textContent = msg;
        jsonStatus.textContent = 'JSON Error';
        jsonStatus.className = 'badge';
        jsonStatus.style.background = 'rgba(244, 63, 94, 0.2)';
        jsonStatus.style.color = '#fb7185';
    }

    /**
     * Update char counter
     */
    function updateCounters() {
        const text = jsonInput.value;
        jsonCharCount.textContent = `${text.length.toLocaleString()} chars`;
    }

    /**
     * Beautify JSON input
     */
    function formatJson() {
        const raw = jsonInput.value.trim();
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            jsonInput.value = JSON.stringify(parsed, null, 2);
            clearErrors();
            updateCounters();
            showToast("JSON formatted cleanly.");
        } catch (e) {
            displayError(`Cannot format: ${e.message}`);
        }
    }

    /**
     * Format bytes to readable string
     */
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Detect font format from filename
     */
    function getFontFormat(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'woff2') return 'woff2';
        if (ext === 'woff') return 'woff';
        if (ext === 'ttf') return 'truetype';
        if (ext === 'otf') return 'opentype';
        return 'truetype';
    }

    /**
     * Handle Font File Upload -> Base64 Encoding
     */
    function handleFontUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64DataUrl = e.target.result;
            const format = getFontFormat(file.name);
            const cleanName = file.name.replace(/\.[^/.]+$/, "");

            customFontState = {
                name: cleanName,
                dataUrl: base64DataUrl,
                format: format
            };

            // Update UI badge
            fontNameDisplay.textContent = cleanName.length > 14 ? cleanName.substring(0, 12) + '...' : cleanName;
            activeFontBadge.style.display = 'inline-flex';
            fontUploadInput.value = ''; // Reset input for re-uploads

            showToast(`Custom Font "${cleanName}" encoded as Base64.`);
            generateHtml();
        };

        reader.onerror = () => {
            displayError("Failed to read font file.");
        };

        reader.readAsDataURL(file);
    }

    /**
     * Remove custom font
     */
    function removeCustomFont() {
        customFontState = null;
        activeFontBadge.style.display = 'none';
        fontUploadInput.value = '';
        showToast("Custom font removed. Reverted to default font.");
        generateHtml();
    }

    /**
     * Renders DOM Tree Schema: { tag, classes, id, style, text, children, attributes }
     */
    function renderDomTree(node, depth = 0) {
        if (!node || typeof node !== 'object') {
            return String(node || '');
        }

        const tag = node.tag || 'div';
        const classes = node.classes || node.class ? ` class="${escapeHtml(node.classes || node.class)}"` : '';
        const id = node.id ? ` id="${escapeHtml(node.id)}"` : '';
        const style = node.style ? ` style="${escapeHtml(node.style)}"` : '';
        
        let extraAttrs = '';
        if (node.attributes && typeof node.attributes === 'object') {
            for (const [k, v] of Object.entries(node.attributes)) {
                extraAttrs += ` ${escapeHtml(k)}="${escapeHtml(String(v))}"`;
            }
        }

        let innerContent = '';
        if (node.text) {
            innerContent += escapeHtml(node.text);
        }

        if (Array.isArray(node.children)) {
            innerContent += '\n' + node.children.map(child => renderDomTree(child, depth + 1)).join('\n');
        }

        return `<${tag}${id}${classes}${style}${extraAttrs}>${innerContent}</${tag}>`;
    }

    /**
     * HTML Escape helper
     */
    function escapeHtml(str) {
        if (typeof str !== 'string') return String(str ?? '');
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Recursive Smart Converter for Generic JSON objects/arrays
     */
    function renderGenericJson(data, depth = 0) {
        if (Array.isArray(data)) {
            const isObjectList = data.length > 0 && typeof data[0] === 'object' && data[0] !== null;
            if (isObjectList) {
                return `
                <div class="grid-cards">
                    ${data.map((item, idx) => `
                        <div class="card">
                            ${typeof item === 'object' ? renderGenericJson(item, depth + 1) : `<p>${escapeHtml(String(item))}</p>`}
                        </div>
                    `).join('')}
                </div>`;
            } else {
                return `
                <ul class="badge-list">
                    ${data.map(item => `<li>${escapeHtml(String(item))}</li>`).join('')}
                </ul>`;
            }
        } else if (typeof data === 'object' && data !== null) {
            let html = '';
            for (const [key, val] of Object.entries(data)) {
                const formattedKey = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())
                    .trim();

                if (typeof val === 'object' && val !== null) {
                    html += `
                    <div class="section-block">
                        <h3 class="section-subheading">${escapeHtml(formattedKey)}</h3>
                        ${renderGenericJson(val, depth + 1)}
                    </div>`;
                } else {
                    html += `
                    <div class="item-row">
                        <span class="item-label">${escapeHtml(formattedKey)}:</span>
                        <span class="item-value">${escapeHtml(String(val))}</span>
                    </div>`;
                }
            }
            return html;
        } else {
            return `<p class="item-value">${escapeHtml(String(data))}</p>`;
        }
    }

    /**
     * Intelligent Web Builder Engine: converts JSON data into complete semantic HTML + responsive CSS
     */
    function compileJsonToWebsiteHtml(data) {
        const pageTitle = data.title || data.siteTitle || data.name || "Generated Website";
        let bodyContent = '';

        // Check if custom font is provided via UI state or JSON data
        const activeFont = customFontState || (data.customFont ? {
            name: data.customFont.name || 'CustomFont',
            dataUrl: data.customFont.dataUrl || data.customFont.base64 || data.customFont,
            format: data.customFont.format || 'truetype'
        } : (data.fontBase64 ? {
            name: 'CustomFont',
            dataUrl: data.fontBase64,
            format: 'truetype'
        } : null));

        // Generate @font-face CSS if custom font exists
        let fontFaceCss = '';
        let fontFamilyRule = "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        let fontGlobalOverride = '';

        if (activeFont && activeFont.dataUrl) {
            fontFaceCss = `
        @font-face {
            font-family: 'CustomUploadedFont';
            src: url('${activeFont.dataUrl}') format('${activeFont.format || 'truetype'}');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
            `;
            fontFamilyRule = "'CustomUploadedFont', 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            fontGlobalOverride = `
        *, html, body, button, input, select, textarea, h1, h2, h3, h4, h5, h6, p, span, a, div, td, th {
            font-family: 'CustomUploadedFont', 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
            `;
        }

        // Check if DOM Tree Schema
        if (data.tag || (data.children && Array.isArray(data.children))) {
            bodyContent = `
            <div class="container domtree-root">
                ${renderDomTree(data)}
            </div>`;
        } else {
            // Intelligent Component-Based Builder
            let sectionsHtml = '';

            // 1. Navigation Bar
            if (data.navbar) {
                const nav = data.navbar;
                const links = Array.isArray(nav.links) ? nav.links : [];
                sectionsHtml += `
                <nav class="site-nav">
                    <div class="nav-container">
                        <a href="#" class="brand-logo">${escapeHtml(nav.brand || pageTitle)}</a>
                        <div class="nav-links">
                            ${links.map(l => `<a href="#${escapeHtml(l.toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(l)}</a>`).join('')}
                            ${nav.cta ? `<a href="#contact" class="btn btn-nav">${escapeHtml(nav.cta)}</a>` : ''}
                        </div>
                    </div>
                </nav>`;
            }

            // 2. Hero Section
            if (data.hero) {
                const h = data.hero;
                sectionsHtml += `
                <header class="hero-section">
                    <div class="container hero-content">
                        ${h.badge ? `<span class="hero-badge">${escapeHtml(h.badge)}</span>` : ''}
                        <h1 class="hero-title">${escapeHtml(h.heading || pageTitle)}</h1>
                        <p class="hero-subtitle">${escapeHtml(h.subheading || '')}</p>
                        <div class="hero-actions">
                            ${h.primaryCta ? `<a href="#action" class="btn btn-primary-hero">${escapeHtml(h.primaryCta)}</a>` : ''}
                            ${h.secondaryCta ? `<a href="#demo" class="btn btn-secondary-hero">${escapeHtml(h.secondaryCta)}</a>` : ''}
                        </div>
                    </div>
                </header>`;
            } else if (data.headline || data.title) {
                sectionsHtml += `
                <header class="hero-section simple-hero">
                    <div class="container">
                        <h1 class="hero-title">${escapeHtml(data.headline || data.title)}</h1>
                        ${data.subheadline || data.description ? `<p class="hero-subtitle">${escapeHtml(data.subheadline || data.description)}</p>` : ''}
                    </div>
                </header>`;
            }

            // 3. Metrics / Stats Section
            if (Array.isArray(data.metrics) || Array.isArray(data.stats)) {
                const stats = data.metrics || data.stats;
                sectionsHtml += `
                <section class="metrics-section" id="metrics">
                    <div class="container">
                        <div class="stats-grid">
                            ${stats.map(m => `
                                <div class="stat-card">
                                    <div class="stat-value">${escapeHtml(m.value || '')}</div>
                                    <div class="stat-label">${escapeHtml(m.label || m.title || '')}</div>
                                    ${m.change ? `<div class="stat-change ${m.trend === 'up' ? 'positive' : ''}">${escapeHtml(m.change)}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </section>`;
            }

            // 4. Skills Chips
            if (Array.isArray(data.skills)) {
                sectionsHtml += `
                <section class="skills-section" id="skills">
                    <div class="container">
                        <h2 class="section-title">Core Competencies and Stack</h2>
                        <div class="skills-chips">
                            ${data.skills.map(s => `<span class="skill-chip">${escapeHtml(s)}</span>`)}
                        </div>
                    </div>
                </section>`;
            }

            // 5. Features Section
            if (Array.isArray(data.features)) {
                sectionsHtml += `
                <section class="features-section" id="features">
                    <div class="container">
                        <h2 class="section-title">Key Capabilities and Features</h2>
                        <div class="features-grid">
                            ${data.features.map(f => `
                                <div class="feature-card">
                                    <h3 class="feature-title">${escapeHtml(f.title || '')}</h3>
                                    <p class="feature-desc">${escapeHtml(f.description || '')}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </section>`;
            }

            // 6. Projects Section
            if (Array.isArray(data.projects)) {
                sectionsHtml += `
                <section class="projects-section" id="projects">
                    <div class="container">
                        <h2 class="section-title">Featured Projects and Case Studies</h2>
                        <div class="projects-grid">
                            ${data.projects.map(p => `
                                <div class="project-card">
                                    ${p.category ? `<span class="project-category">${escapeHtml(p.category)}</span>` : ''}
                                    <h3 class="project-title">${escapeHtml(p.title || '')}</h3>
                                    <p class="project-desc">${escapeHtml(p.description || '')}</p>
                                    ${Array.isArray(p.tags) ? `
                                        <div class="project-tags">
                                            ${p.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </section>`;
            }

            // 7. Product Showcase
            if (data.product) {
                const p = data.product;
                sectionsHtml += `
                <section class="product-section" id="product">
                    <div class="container product-wrapper">
                        <div class="product-info-card">
                            ${p.badge ? `<span class="product-badge">${escapeHtml(p.badge)}</span>` : ''}
                            <h1 class="product-title">${escapeHtml(p.name || '')}</h1>
                            <p class="product-tagline">${escapeHtml(p.tagline || '')}</p>
                            <div class="product-price-row">
                                <span class="current-price">${escapeHtml(p.price || '')}</span>
                                ${p.originalPrice ? `<span class="original-price">${escapeHtml(p.originalPrice)}</span>` : ''}
                                ${p.rating ? `<span class="product-rating">${escapeHtml(p.rating)}</span>` : ''}
                            </div>
                            <p class="product-desc">${escapeHtml(p.description || '')}</p>
                            ${Array.isArray(p.highlights) ? `
                                <div class="product-highlights">
                                    <h4>Key Highlights:</h4>
                                    <ul>${p.highlights.map(h => `<li>- ${escapeHtml(h)}</li>`).join('')}</ul>
                                </div>
                            ` : ''}
                            ${p.specs && typeof p.specs === 'object' ? `
                                <div class="specs-table">
                                    <h4>Technical Specifications:</h4>
                                    <table>
                                        ${Object.entries(p.specs).map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join('')}
                                    </table>
                                </div>
                            ` : ''}
                            ${p.cta ? `<button class="btn btn-buy-now">${escapeHtml(p.cta)}</button>` : ''}
                        </div>
                    </div>
                </section>`;
            }

            // 8. Article / Blog Post
            if (data.article) {
                const a = data.article;
                sectionsHtml += `
                <article class="article-section" id="blog">
                    <div class="container article-container">
                        <div class="article-header">
                            ${a.category ? `<span class="article-category">${escapeHtml(a.category)}</span>` : ''}
                            <h1 class="article-title">${escapeHtml(a.heading || '')}</h1>
                            <div class="article-meta">
                                ${a.author ? `<span class="author">By ${escapeHtml(a.author.name || '')} (${escapeHtml(a.author.role || '')})</span> - ` : ''}
                                <span>${escapeHtml(a.publishedAt || '')}</span> - <span>${escapeHtml(a.readTime || '')}</span>
                            </div>
                            ${a.lead ? `<p class="article-lead">${escapeHtml(a.lead)}</p>` : ''}
                        </div>
                        ${Array.isArray(a.sections) ? `
                            <div class="article-body">
                                ${a.sections.map(s => `
                                    <section class="article-part">
                                        <h2>${escapeHtml(s.subtitle || '')}</h2>
                                        <p>${escapeHtml(s.content || '')}</p>
                                    </section>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </article>`;
            }

            // 9. Activity Table
            if (Array.isArray(data.recentActivity)) {
                sectionsHtml += `
                <section class="table-section" id="activity">
                    <div class="container">
                        <h2 class="section-title">Live Platform Activity and Logs</h2>
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        ${Object.keys(data.recentActivity[0] || {}).map(k => `<th>${escapeHtml(k.toUpperCase())}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.recentActivity.map(row => `
                                        <tr>
                                            ${Object.values(row).map(v => `<td>${escapeHtml(String(v))}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>`;
            }

            // 10. Testimonials
            if (Array.isArray(data.testimonials)) {
                sectionsHtml += `
                <section class="testimonials-section">
                    <div class="container">
                        <h2 class="section-title">Testimonials</h2>
                        <div class="testimonials-grid">
                            ${data.testimonials.map(t => `
                                <div class="testimonial-card">
                                    <p class="quote">"${escapeHtml(t.quote)}"</p>
                                    <div class="author-info">
                                        <strong>${escapeHtml(t.author)}</strong>
                                        <span>${escapeHtml(t.role)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </section>`;
            }

            // 11. FAQ Section
            if (Array.isArray(data.faq)) {
                sectionsHtml += `
                <section class="faq-section" id="faq">
                    <div class="container faq-container">
                        <h2 class="section-title">Frequently Asked Questions</h2>
                        <div class="faq-list">
                            ${data.faq.map(item => `
                                <details class="faq-item" open>
                                    <summary class="faq-question">${escapeHtml(item.question)}</summary>
                                    <div class="faq-answer"><p>${escapeHtml(item.answer)}</p></div>
                                </details>
                            `).join('')}
                        </div>
                    </div>
                </section>`;
            }

            // 12. Call to Action Banner
            if (data.ctaBanner) {
                const cta = data.ctaBanner;
                sectionsHtml += `
                <section class="cta-banner-section">
                    <div class="container">
                        <div class="cta-banner-card">
                            <h2 class="cta-headline">${escapeHtml(cta.headline)}</h2>
                            <p class="cta-desc">${escapeHtml(cta.description)}</p>
                            <div class="cta-actions">
                                ${cta.primaryButton ? `<a href="#signup" class="btn btn-primary-hero">${escapeHtml(cta.primaryButton)}</a>` : ''}
                                ${cta.secondaryButton ? `<a href="#docs" class="btn btn-secondary-hero">${escapeHtml(cta.secondaryButton)}</a>` : ''}
                            </div>
                        </div>
                    </div>
                </section>`;
            }

            // 13. Contact Information Card
            if (data.contact) {
                const c = data.contact;
                sectionsHtml += `
                <section class="contact-section" id="contact">
                    <div class="container contact-container">
                        <div class="contact-card">
                            <h2 class="section-title" style="margin-bottom: 12px;">${escapeHtml(c.headline || 'Contact Us')}</h2>
                            <p class="contact-sub">${escapeHtml(c.description || '')}</p>
                            <div class="contact-details">
                                ${c.email ? `<div class="contact-item"><strong>Email:</strong> <a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></div>` : ''}
                                ${c.phone ? `<div class="contact-item"><strong>Phone:</strong> <span>${escapeHtml(c.phone)}</span></div>` : ''}
                                ${c.location ? `<div class="contact-item"><strong>Office:</strong> <span>${escapeHtml(c.location)}</span></div>` : ''}
                            </div>
                        </div>
                    </div>
                </section>`;
            }

            // 14. Custom Properties / Generic JSON Content
            if (data.customProperties) {
                sectionsHtml += `
                <section class="custom-props-section">
                    <div class="container">
                        <h2 class="section-title">System Specifications and Metadata</h2>
                        <div class="card generic-card">
                            ${renderGenericJson(data.customProperties)}
                        </div>
                    </div>
                </section>`;
            } else if (!sectionsHtml) {
                sectionsHtml = `
                <div class="container generic-content">
                    ${renderGenericJson(data)}
                </div>`;
            }

            // 15. Footer
            if (data.footer) {
                const f = data.footer;
                const links = Array.isArray(f.links) ? f.links : [];
                sectionsHtml += `
                <footer class="site-footer">
                    <div class="container footer-content">
                        <p class="copyright">${escapeHtml(f.copyright || 'Copyright All rights reserved.')}</p>
                        ${links.length > 0 ? `
                            <div class="footer-links">
                                ${links.map(l => `<a href="#">${escapeHtml(l)}</a>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </footer>`;
            }

            bodyContent = sectionsHtml;
        }

        // Return Complete Standalone HTML Document with Non-Moving Tag & Base64 Font (No Emojis)
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(pageTitle)}</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>${fontFaceCss}
        :root {
            --bg-page: #000000;
            --bg-card: #080808;
            --bg-card-hover: #121212;
            --border-color: #2a2a2a;
            --border-light: #3d3d3d;
            --text-main: #ffffff;
            --text-muted: #a1a1aa;
            --accent-primary: #ffffff;
            --radius-md: 6px;
            --radius-lg: 8px;
            --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.8);
            --font-family: ${fontFamilyRule};
            --text-glow-white: 0 0 14px rgba(255, 255, 255, 0.45), 0 0 28px rgba(255, 255, 255, 0.2);
            --text-glow-subtle: 0 0 8px rgba(255, 255, 255, 0.35);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
${fontGlobalOverride}
        body {
            font-family: var(--font-family);
            background-color: var(--bg-page);
            color: var(--text-main);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }

        .container {
            max-width: 1140px;
            margin: 0 auto;
            padding: 0 24px;
        }

        /* Nav */
        .site-nav {
            background: rgba(0, 0, 0, 0.92);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .nav-container {
            max-width: 1140px;
            margin: 0 auto;
            padding: 16px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .brand-logo {
            font-size: 1.3rem;
            font-weight: 700;
            color: #ffffff;
            text-decoration: none;
            text-shadow: var(--text-glow-white);
        }
        .nav-links {
            display: flex;
            align-items: center;
            gap: 18px;
            flex-wrap: wrap;
        }
        .nav-links a {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.92rem;
            font-weight: 500;
            transition: color 0.2s, text-shadow 0.2s;
        }
        .nav-links a:hover {
            color: #ffffff;
            text-shadow: var(--text-glow-subtle);
        }

        /* Buttons */
        .btn {
            display: inline-block;
            padding: 10px 22px;
            border-radius: var(--radius-sm);
            font-weight: 600;
            font-size: 0.92rem;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid var(--border-color);
            background: #0d0d0d;
            color: #ffffff;
        }
        .btn-nav {
            background: #141414;
            border: 1px solid #383838;
            color: #ffffff !important;
            padding: 8px 18px;
        }
        .btn-nav:hover {
            border-color: #666666;
            text-shadow: var(--text-glow-subtle);
        }
        .btn-primary-hero {
            background: #141414;
            border: 1px solid #4a4a4a;
            color: #ffffff;
            text-shadow: var(--text-glow-subtle);
            box-shadow: 0 0 12px rgba(255, 255, 255, 0.1);
        }
        .btn-primary-hero:hover {
            transform: translateY(-2px);
            background: #1f1f1f;
            border-color: #777777;
            text-shadow: var(--text-glow-white);
            box-shadow: 0 0 18px rgba(255, 255, 255, 0.2);
        }
        .btn-secondary-hero {
            background: var(--bg-card);
            color: var(--text-main);
            border: 1px solid var(--border-color);
        }
        .btn-secondary-hero:hover {
            background: #181818;
            border-color: var(--border-light);
            text-shadow: var(--text-glow-subtle);
        }

        /* Hero */
        .hero-section {
            padding: 80px 0 60px;
            text-align: center;
            position: relative;
        }
        .hero-badge {
            display: inline-block;
            background: #0a0a0a;
            border: 1px solid var(--border-color);
            color: #d4d4d8;
            padding: 6px 16px;
            border-radius: var(--radius-sm);
            font-size: 0.82rem;
            font-weight: 600;
            margin-bottom: 20px;
            text-shadow: var(--text-glow-subtle);
        }
        .hero-title {
            font-size: 3.2rem;
            font-weight: 800;
            letter-spacing: -0.03em;
            line-height: 1.15;
            margin-bottom: 20px;
            color: #ffffff;
            text-shadow: var(--text-glow-white);
        }
        .hero-subtitle {
            font-size: 1.15rem;
            color: var(--text-muted);
            max-width: 720px;
            margin: 0 auto 32px;
        }
        .hero-actions {
            display: flex;
            gap: 16px;
            justify-content: center;
            flex-wrap: wrap;
        }

        /* Section Titles */
        .section-title {
            font-size: 2rem;
            font-weight: 700;
            text-align: center;
            margin-bottom: 36px;
            letter-spacing: -0.02em;
            color: #ffffff;
            text-shadow: var(--text-glow-white);
        }

        /* Metrics / Stats */
        .metrics-section { padding: 40px 0; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
        }
        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 24px;
            text-align: center;
            box-shadow: var(--shadow-card);
        }
        .stat-value {
            font-size: 2.2rem;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 4px;
            text-shadow: var(--text-glow-white);
        }
        .stat-label {
            font-size: 0.88rem;
            color: var(--text-muted);
            font-weight: 500;
        }
        .stat-change {
            font-size: 0.8rem;
            color: #a1a1aa;
            margin-top: 6px;
            font-weight: 600;
        }

        /* Features */
        .features-section { padding: 60px 0; }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .feature-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 32px 28px;
            transition: all 0.25s ease;
            box-shadow: var(--shadow-card);
        }
        .feature-card:hover {
            transform: translateY(-3px);
            border-color: var(--border-light);
            background: var(--bg-card-hover);
            box-shadow: 0 0 16px rgba(255, 255, 255, 0.05);
        }
        .feature-title {
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 10px;
            color: #ffffff;
            text-shadow: var(--text-glow-subtle);
        }
        .feature-desc {
            color: var(--text-muted);
            font-size: 0.95rem;
            line-height: 1.6;
        }

        /* Skills & Chips */
        .skills-section { padding: 40px 0; text-align: center; }
        .skills-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            max-width: 840px;
            margin: 0 auto;
        }
        .skill-chip {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            color: #ffffff;
            padding: 8px 18px;
            border-radius: var(--radius-sm);
            font-size: 0.88rem;
            font-weight: 600;
            text-shadow: var(--text-glow-subtle);
        }

        /* Projects Grid */
        .projects-section { padding: 60px 0; }
        .projects-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
        }
        .project-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 28px;
            box-shadow: var(--shadow-card);
            display: flex;
            flex-direction: column;
            transition: border-color 0.2s;
        }
        .project-card:hover {
            border-color: var(--border-light);
            background: var(--bg-card-hover);
        }
        .project-category {
            font-size: 0.76rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #a1a1aa;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .project-title { font-size: 1.3rem; margin-bottom: 10px; color: #ffffff; text-shadow: var(--text-glow-subtle); }
        .project-desc { color: var(--text-muted); font-size: 0.92rem; margin-bottom: 18px; flex: 1; }
        .project-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag {
            background: #000000;
            border: 1px solid var(--border-color);
            font-size: 0.76rem;
            padding: 3px 10px;
            border-radius: var(--radius-sm);
            color: #d4d4d8;
        }

        /* Product Showcase */
        .product-section { padding: 60px 0; }
        .product-info-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 40px;
            box-shadow: var(--shadow-card);
            max-width: 800px;
            margin: 0 auto;
        }
        .product-badge {
            background: #111111;
            border: 1px solid var(--border-color);
            color: #ffffff;
            padding: 4px 12px;
            border-radius: var(--radius-sm);
            font-size: 0.8rem;
            font-weight: 600;
            display: inline-block;
            margin-bottom: 14px;
            text-shadow: var(--text-glow-subtle);
        }
        .product-title { font-size: 2.2rem; font-weight: 800; margin-bottom: 6px; color: #ffffff; text-shadow: var(--text-glow-white); }
        .product-tagline { color: var(--text-muted); font-size: 1.1rem; margin-bottom: 18px; }
        .product-price-row { display: flex; align-items: baseline; gap: 14px; margin-bottom: 20px; }
        .current-price { font-size: 2.2rem; font-weight: 800; color: #ffffff; text-shadow: var(--text-glow-white); }
        .original-price { font-size: 1.2rem; color: #52525b; text-decoration: line-through; }
        .product-rating { font-size: 0.92rem; color: #a1a1aa; }
        .product-desc { color: #d4d4d8; font-size: 1rem; margin-bottom: 24px; line-height: 1.6; }
        .product-highlights { margin-bottom: 24px; }
        .product-highlights h4 { margin-bottom: 10px; font-size: 1rem; color: #ffffff; text-shadow: var(--text-glow-subtle); }
        .product-highlights ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .product-highlights li { color: var(--text-muted); font-size: 0.92rem; }
        .specs-table { margin-bottom: 30px; }
        .specs-table h4 { margin-bottom: 12px; font-size: 1rem; color: #ffffff; text-shadow: var(--text-glow-subtle); }
        .specs-table table { width: 100%; border-collapse: collapse; }
        .specs-table th, .specs-table td { padding: 10px 14px; border: 1px solid var(--border-color); font-size: 0.88rem; }
        .specs-table th { background: #000000; text-align: left; color: var(--text-muted); width: 35%; }
        .btn-buy-now {
            width: 100%;
            background: #141414;
            border: 1px solid #4a4a4a;
            color: #ffffff;
            padding: 16px;
            font-size: 1.1rem;
            border-radius: var(--radius-sm);
            font-weight: 700;
            text-shadow: var(--text-glow-subtle);
        }
        .btn-buy-now:hover {
            background: #1f1f1f;
            border-color: #777777;
            text-shadow: var(--text-glow-white);
            box-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
        }

        /* Article View */
        .article-section { padding: 60px 0; }
        .article-container { max-width: 780px; }
        .article-header { margin-bottom: 40px; border-bottom: 1px solid var(--border-color); padding-bottom: 30px; }
        .article-category { color: #a1a1aa; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; }
        .article-title { font-size: 2.5rem; font-weight: 800; line-height: 1.2; margin: 12px 0 16px; color: #ffffff; text-shadow: var(--text-glow-white); }
        .article-meta { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px; }
        .article-lead { font-size: 1.18rem; color: #e4e4e7; line-height: 1.65; }
        .article-body { display: flex; flex-direction: column; gap: 32px; }
        .article-part h2 { font-size: 1.45rem; margin-bottom: 12px; color: #ffffff; text-shadow: var(--text-glow-subtle); }
        .article-part p { color: #d4d4d8; font-size: 1.05rem; line-height: 1.7; }

        /* Tables */
        .table-section { padding: 50px 0; }
        .table-responsive { overflow-x: auto; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th, .data-table td { padding: 14px 20px; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; }
        .data-table th { background: #000000; color: var(--text-muted); font-weight: 600; font-size: 0.8rem; }
        .data-table tr:hover { background: #141414; }

        /* Testimonials */
        .testimonials-section { padding: 60px 0; }
        .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .testimonial-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 30px;
            box-shadow: var(--shadow-card);
        }
        .testimonial-card .quote { font-style: italic; color: #e4e4e7; margin-bottom: 20px; font-size: 1rem; }
        .testimonial-card .author-info strong { display: block; color: #ffffff; font-size: 0.95rem; text-shadow: var(--text-glow-subtle); }
        .testimonial-card .author-info span { color: var(--text-muted); font-size: 0.82rem; }

        /* FAQ Section */
        .faq-section { padding: 60px 0; }
        .faq-container { max-width: 820px; margin: 0 auto; }
        .faq-list { display: flex; flex-direction: column; gap: 12px; }
        .faq-item {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 18px 24px;
            transition: border-color 0.2s;
        }
        .faq-item:hover { border-color: var(--border-light); }
        .faq-question {
            font-size: 1.05rem;
            font-weight: 600;
            color: #ffffff;
            cursor: pointer;
            outline: none;
            user-select: none;
            text-shadow: var(--text-glow-subtle);
        }
        .faq-answer { margin-top: 12px; color: var(--text-muted); font-size: 0.96rem; line-height: 1.6; }

        /* CTA Banner */
        .cta-banner-section { padding: 60px 0; }
        .cta-banner-card {
            background: #080808;
            border: 1px solid var(--border-light);
            border-radius: var(--radius-md);
            padding: 50px 30px;
            text-align: center;
            box-shadow: var(--shadow-card);
        }
        .cta-headline { font-size: 2.2rem; font-weight: 800; margin-bottom: 12px; color: #ffffff; text-shadow: var(--text-glow-white); }
        .cta-desc { color: var(--text-muted); font-size: 1.1rem; max-width: 600px; margin: 0 auto 28px; }
        .cta-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

        /* Contact Section */
        .contact-section { padding: 50px 0; }
        .contact-container { max-width: 700px; margin: 0 auto; }
        .contact-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            padding: 36px;
            text-align: center;
            box-shadow: var(--shadow-card);
        }
        .contact-sub { color: var(--text-muted); margin-bottom: 24px; font-size: 0.95rem; }
        .contact-details { display: flex; flex-direction: column; gap: 12px; text-align: left; max-width: 480px; margin: 0 auto; }
        .contact-item { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; }
        .contact-item a { color: #ffffff; text-decoration: none; text-shadow: var(--text-glow-subtle); }
        .contact-item a:hover { text-decoration: underline; }

        /* Custom Props */
        .custom-props-section { padding: 40px 0; }
        .generic-card { padding: 24px; border-radius: var(--radius-md); }
        .section-block { margin-bottom: 20px; }
        .section-subheading { font-size: 1.15rem; color: #ffffff; margin-bottom: 10px; text-shadow: var(--text-glow-subtle); }
        .item-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color); }
        .item-label { font-weight: 600; color: var(--text-muted); }
        .item-value { color: #ffffff; }
        .badge-list { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
        .badge-list li { background: #000000; border: 1px solid var(--border-color); padding: 6px 14px; border-radius: var(--radius-sm); font-size: 0.88rem; color: #ffffff; }

        /* Footer */
        .site-footer {
            border-top: 1px solid var(--border-color);
            padding: 40px 0;
            margin-top: 60px;
            background: #000000;
        }
        .footer-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
        }
        .copyright { color: var(--text-muted); font-size: 0.88rem; }
        .footer-links { display: flex; gap: 20px; }
        .footer-links a { color: var(--text-muted); text-decoration: none; font-size: 0.88rem; transition: color 0.2s; }
        .footer-links a:hover { color: #ffffff; text-shadow: var(--text-glow-subtle); }

        /* Fixed Non-Moving Bottom-Right Badge: 69% transparency (0.31 opacity), rectangle, fades to 0% transparency (1.0 opacity) on hover */
        .gbuild-badge {
            position: fixed !important;
            bottom: 18px !important;
            right: 18px !important;
            z-index: 999999 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            background: #000000 !important;
            color: #f8fafc !important;
            border: 1px solid #333333 !important;
            padding: 8px 16px !important;
            border-radius: 0px !important;
            opacity: 0.31 !important;
            font-family: var(--font-family) !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            text-decoration: none !important;
            text-shadow: var(--text-glow-subtle) !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.8) !important;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s ease, border-color 0.2s ease !important;
            cursor: pointer !important;
            user-select: none !important;
            transform: translateZ(0);
        }
        .gbuild-badge:hover {
            opacity: 1 !important;
            transform: translateY(-2px) scale(1.04) !important;
            border-color: #666666 !important;
            text-shadow: var(--text-glow-white) !important;
            box-shadow: 0 0 16px rgba(255, 255, 255, 0.15) !important;
            background: #080808 !important;
            color: #ffffff !important;
        }
        .gbuild-badge strong {
            color: #ffffff !important;
            font-weight: 700 !important;
            text-shadow: var(--text-glow-white) !important;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .hero-title { font-size: 2.2rem; }
            .nav-links { display: none; }
            .footer-content { flex-direction: column; text-align: center; }
            .gbuild-badge { bottom: 12px !important; right: 12px !important; padding: 6px 12px !important; font-size: 12px !important; border-radius: 0px !important; }
        }
    </style>
</head>
<body>
    ${bodyContent}

    <!-- Fixed Non-Moving Bottom-Right Tag: Always links to notgreg.space/gbuild -->
    <a href="https://notgreg.space/gbuild" target="_blank" rel="noopener noreferrer" class="gbuild-badge" title="Built with gbuild (notgreg.space/gbuild)">
        <span class="gbuild-text">Built with <strong>gbuild</strong></span>
    </a>
</body>
</html>`;
    }

    /**
     * Main HTML Generation Trigger
     */
    function generateHtml() {
        clearErrors();
        const jsonString = jsonInput.value.trim();

        if (!jsonString) {
            displayError("Please paste JSON data or choose a template preset.");
            previewFrame.srcdoc = '';
            htmlOutput.value = '';
            htmlSizeBadge.textContent = '0 B';
            return;
        }

        let parsedData;
        try {
            parsedData = JSON.parse(jsonString);
        } catch (e) {
            displayError(`JSON Syntax Error: ${e.message}`);
            return;
        }

        // Generate complete HTML document
        const generatedHtml = compileJsonToWebsiteHtml(parsedData);
        currentGeneratedHtml = generatedHtml;

        // 1. Update Live Iframe Preview
        previewFrame.srcdoc = generatedHtml;

        // 2. Update HTML Code Output Box
        htmlOutput.value = generatedHtml;

        // 3. Update size badges and metadata
        const byteSize = new Blob([generatedHtml]).size;
        htmlSizeBadge.textContent = formatBytes(byteSize);
        outputMeta.textContent = `Generated: ${new Date().toLocaleTimeString()} (${byteSize.toLocaleString()} bytes)`;

        updateCounters();
    }

    /**
     * Copy HTML to clipboard
     */
    async function copyHtmlToClipboard() {
        if (!currentGeneratedHtml) {
            generateHtml();
        }
        if (!currentGeneratedHtml) {
            displayError("No HTML generated to copy.");
            return;
        }

        try {
            await navigator.clipboard.writeText(currentGeneratedHtml);
            showToast("HTML code copied to clipboard.");
        } catch (err) {
            // Fallback for clipboard
            htmlOutput.select();
            document.execCommand('copy');
            showToast("HTML code copied to clipboard.");
        }
    }

    /**
     * Download HTML file
     */
    function downloadHtmlFile() {
        if (!currentGeneratedHtml) {
            generateHtml();
        }
        if (!currentGeneratedHtml) {
            displayError("No HTML generated to download.");
            return;
        }

        const blob = new Blob([currentGeneratedHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated_website.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast("Downloaded generated_website.html");
    }

    /**
     * Open preview in a new window/tab
     */
    function openPreviewInNewTab() {
        if (!currentGeneratedHtml) {
            generateHtml();
        }
        if (!currentGeneratedHtml) return;

        const blob = new Blob([currentGeneratedHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    /**
     * Load Template
     */
    function loadTemplate(templateKey) {
        const templateData = templates[templateKey] || templates.all;
        jsonInput.value = JSON.stringify(templateData, null, 2);
        templateSelect.value = templateKey;
        updateCounters();
        generateHtml();
        showToast(`Loaded ${templateKey.toUpperCase()} template`);
    }

    // --- Tab Switching Handlers ---
    tabPreviewBtn.addEventListener('click', () => {
        tabPreviewBtn.classList.add('active');
        tabCodeBtn.classList.remove('active');
        tabPreview.classList.add('active');
        tabCode.classList.remove('active');
    });

    tabCodeBtn.addEventListener('click', () => {
        tabCodeBtn.classList.add('active');
        tabPreviewBtn.classList.remove('active');
        tabCode.classList.add('active');
        tabPreview.classList.remove('active');
    });

    // --- Viewport Switching Handlers ---
    viewportBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            viewportBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const viewport = btn.getAttribute('data-viewport');
            previewContainer.className = `preview-container viewport-${viewport}`;
        });
    });

    // --- Event Listeners ---
    generateBtn.addEventListener('click', generateHtml);
    formatBtn.addEventListener('click', formatJson);
    copyHtmlBtn.addEventListener('click', copyHtmlToClipboard);
    downloadBtn.addEventListener('click', downloadHtmlFile);
    openNewTabBtn.addEventListener('click', openPreviewInNewTab);

    // Font upload & remove listeners
    if (fontUploadInput) {
        fontUploadInput.addEventListener('change', handleFontUpload);
    }
    if (removeFontBtn) {
        removeFontBtn.addEventListener('click', removeCustomFont);
    }

    clearBtn.addEventListener('click', () => {
        jsonInput.value = '';
        previewFrame.srcdoc = '';
        htmlOutput.value = '';
        currentGeneratedHtml = '';
        htmlSizeBadge.textContent = '0 B';
        clearErrors();
        updateCounters();
    });

    templateSelect.addEventListener('change', (e) => {
        loadTemplate(e.target.value);
    });

    // Live char count & instant syntax indicator
    jsonInput.addEventListener('input', () => {
        updateCounters();
        try {
            if (jsonInput.value.trim()) {
                JSON.parse(jsonInput.value);
                clearErrors();
            }
        } catch (e) {
            // Keep error subtle during typing
            jsonStatus.textContent = 'Editing...';
            jsonStatus.className = 'badge';
        }
    });

    // Keyboard shortcut: Ctrl+Enter / Cmd+Enter
    jsonInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            generateHtml();
        }
    });

    // Initialize with default template: ALL ELEMENTS
    loadTemplate('all');
});