/* ------------------------------------------------------------------
   All site content lives here. Edit this file to update the portfolio.
   ------------------------------------------------------------------ */

const SITE = {
	brand: "NCore",
	name: "Nishant Sharma",
	user: "nishant",
	host: "core",
	role: "AI/ML Engineer",
	tagline: "// shipping LLMs to production.",
	headline: "AI engineer who puts LLMs into production.",
	location: "Jaipur, Rajasthan, India",
	email: "business.nishant777@gmail.com",
	resume: "https://nishantsharma.vercel.app/assets/Nishant_Sharma_Resume.pdf",
	github: "https://github.com/Nishant-444",
	linkedin: "https://www.linkedin.com/in/nishant-developer",
	x: "https://x.com/_nishant4712",
	about:
		"Software engineer with hands-on GenAI engineering experience — LLM integration, RAG pipelines, embeddings, vector stores, guardrails and agentic workflows. I've shipped two live AI platforms end to end and built secure REST APIs with FastAPI, Spring Boot and Node.js on Docker, AWS and CI/CD. Twice recommended by the Indian Air Force SSB, and an open-source contributor to a 7k+ star LLM engineering repo.",
	status: "open to full-time roles",
};

const LINKS = [
	{
		id: "github",
		label: "github",
		handle: "Nishant-444",
		url: "https://github.com/Nishant-444",
	},
	{
		id: "linkedin",
		label: "linkedin",
		handle: "nishant-developer",
		url: "https://www.linkedin.com/in/nishant-developer",
	},
	{
		id: "x",
		label: "x",
		handle: "@_nishant4712",
		url: "https://x.com/_nishant4712",
	},
	{
		id: "leetcode",
		label: "leetcode",
		handle: "nishant4712",
		url: "https://leetcode.com/u/nishant4712/",
	},
	{
		id: "codeforces",
		label: "codeforces",
		handle: "nishant4712",
		url: "https://codeforces.com/profile/nishant4712",
	},
	{
		id: "hackerrank",
		label: "hackerrank",
		handle: "business_nishan1",
		url: "https://www.hackerrank.com/profile/business_nishan1",
	},
	{
		id: "chess",
		label: "chess.com",
		handle: "nishant_4712",
		url: "https://www.chess.com/member/nishant_4712",
	},
	{
		id: "substack",
		label: "substack",
		handle: "@nishant4712",
		url: "https://substack.com/@nishant4712",
	},
	{
		id: "resume",
		label: "résumé",
		handle: "Nishant_Sharma_Resume.pdf",
		url: SITE.resume,
	},
];

const PROJECTS = [
	{
		id: "viztube",
		name: "VizTube",
		status: "shipped",
		year: 2025,
		period: "Aug 2025 – Present",
		tagline:
			"Video platform backend with an AI-powered RAG engine — ask any video a question and get an answer with cited timestamps.",
		notes: [
			"Built 43 REST endpoints across 8 modules (auth, uploads, comments, subscriptions, analytics) on a normalized 8-table PostgreSQL schema with UUIDv7 keys to prevent B-tree fragmentation.",
			"Engineered a RAG pipeline — Groq Whisper transcription to 384-dim local embeddings to pgvector, top-5 chunk retrieval — for question-answering over any video, with cited sources.",
			"Runs all 3 services on a single 1 GB RAM / 2 vCPU EC2 instance by design, shipped via Docker and GitHub Actions CI/CD behind Nginx and Cloudflare.",
		],
		stack: [
			"TypeScript",
			"Node.js",
			"Express",
			"FastAPI",
			"PostgreSQL",
			"pgvector",
			"Prisma",
			"Docker",
			"AWS",
			"Groq",
		],
		github: "https://github.com/Nishant-444/VizTube",
		live: "https://viztube.me/",
		liveLabel: "live-api",
		thumb: [
			" ┌───────────┐",
			" │  ▶   0:42 │",
			" └───────────┘",
			"  ask any video",
		],
	},
	{
		id: "weave",
		name: "Weave",
		status: "built",
		year: 2026,
		period: "Sep 2026 – Present",
		tagline:
			"Multi-tenant PDF & CSV RAG system with Text-to-SQL and deterministic citations — semantic search for documents, generated SQL for numbers.",
		notes: [
			"Built a dual-path RAG engine — pgvector semantic search plus generated Text-to-SQL over 384-dim embeddings — eliminating 100% of LLM arithmetic hallucination on tabular data.",
			"Engineered dual-LLM failover across 2 providers (Gemini to Groq) with pre-stream 429 detection, so SSE streams never start on a rate-limited model.",
			"Enforced a SQL sandbox that blocks 7 mutating keywords (DROP, DELETE, INSERT, UPDATE, ALTER, TRUNCATE, CREATE) with tenant isolation across 5 core tables via collection_id.",
		],
		stack: [
			"Python",
			"FastAPI",
			"PostgreSQL",
			"pgvector",
			"Docker",
			"React",
			"TypeScript",
			"Gemini",
			"Groq",
		],
		github: "https://github.com/Nishant-444/Weave",
		thumb: [" [sales.csv]", " [contract.pdf]", "", "  ⇢ p.12 · sql"],
	},
	{
		id: "echoinbox",
		name: "EchoInbox",
		status: "built",
		year: 2026,
		period: "Jun 2026 – Jul 2026",
		tagline:
			"Anonymous messaging platform with AI-assisted replies — structured Groq output, hardened auth, and a cascade-safe Postgres schema.",
		notes: [
			"Built a custom NextAuth credentials flow — 6-digit expiring email verification via Resend, bcrypt-hashed passwords, and Zod validation on every input.",
			"Designed a cascade-safe Prisma schema with transactional account deletion, relational integrity and indexed retrieval, using UUIDv7 keys to keep index lookups sequential.",
			"Integrated Groq Llama 3.3 through the Vercel AI SDK with Zod-enforced structured suggestions, an 8-second timeout guard, and parallel dashboard loads.",
		],
		stack: [
			"Next.js",
			"TypeScript",
			"PostgreSQL",
			"Prisma",
			"NeonDB",
			"NextAuth",
			"Vercel AI SDK",
			"Groq",
			"Resend",
			"Zod",
		],
		github: "https://github.com/Nishant-444/echoinbox",
		live: "https://echoinboxchat.vercel.app/",
		liveLabel: "live-app",
		thumb: [
			"  ┌──────────┐",
			"  │ anon   ✉ │",
			"  └──┬───────┘",
			"     ↳ ai reply",
		],
	},
	{
		id: "jobtrack",
		name: "Job Application Tracker",
		short: "jobtrack",
		status: "shipped",
		year: 2026,
		period: "2026",
		tagline:
			"Full-stack Kanban platform for job hunting — React Server Components, optimistic drag-and-drop, and O(1) float ordering.",
		notes: [
			"Built on Next.js App Router with React Server Components to eliminate client-side loading waterfalls, with end-to-end type safety between Server Actions and the database layer.",
			"Implemented a dnd-kit Kanban board with optimistic UI updates and an O(1) float ordering scheme, so reordering a card writes one row instead of renumbering the column.",
			"Wired Better Auth database hooks to auto-provision a 5-stage pipeline on registration, and shipped a multi-stage Docker build on Next.js standalone output to AWS EC2 behind Nginx with Certbot SSL renewal.",
		],
		stack: [
			"Next.js 16",
			"React 19",
			"TypeScript",
			"PostgreSQL",
			"Prisma 7",
			"dnd-kit",
			"Better Auth",
			"Docker",
			"AWS",
			"Nginx",
		],
		github: "https://github.com/Nishant-444/job_application_tracker",
		live: "https://allidoistrackajob.vercel.app/",
		liveLabel: "live-app",
		thumb: [" ▢  ▢  ▢  ▢", " ▢  ▢     ▢", " ▢", " applied → offer"],
	},
	{
		id: "appraisehub",
		name: "AppraiseHub",
		status: "shipped",
		year: 2026,
		period: "2026",
		tagline:
			"Employee appraisal platform with multi-role RBAC workflows across a layered Spring Boot backend and a Next.js dashboard.",
		notes: [
			"Layered Spring Boot service on MySQL with DTO-isolated API contracts and global exception handling.",
			"Spring Security 6 + JWT role-based access separating HR, manager and employee actors at the route level.",
		],
		stack: [
			"Java",
			"Spring Boot",
			"Spring Security 6",
			"MySQL",
			"Next.js",
			"React",
			"JWT",
			"Docker",
		],
		github: "https://github.com/Nishant-444/AppraiseHub",
		live: "https://appraise-hub.vercel.app/",
		liveLabel: "live-app",
		thumb: ["", "   ✓ review approved", "", "  emp → mgr → hr"],
	},
	{
		id: "trend-engine",
		name: "Trend Engine",
		status: "shipped",
		year: 2025,
		period: "2025",
		tagline:
			"Real-time movie discovery app whose trending list is generated from live user search patterns rather than a static feed.",
		notes: [
			"Built a trending algorithm that captures and aggregates user search queries in an Appwrite database to rank titles in real time.",
			"Engineered debounced search to cut redundant API calls, on a mobile-first responsive UI deployed to Vercel via automated builds.",
		],
		stack: ["React 18", "Vite", "Tailwind CSS v4", "Appwrite", "TMDB API"],
		github: "https://github.com/Nishant-444/Trend-Engine",
		live: "https://trend-engine.vercel.app/",
		liveLabel: "live-demo",
		thumb: [" 1 █████████", " 2 ██████", " 3 ████", " 4 ██"],
	},
	{
		id: "modern-web-boilerplate",
		name: "Modern Web Stack Boilerplate",
		short: "boilerplate",
		status: "built",
		year: 2026,
		period: "2026",
		tagline:
			"A 2026 production web-stack guide covering three project shapes with database variants, verified against official docs.",
		notes: [
			"Documents App Router with Turbopack defaults and the prisma.config.ts-era Prisma 7 setup, with every version pinned against official documentation.",
		],
		stack: [
			"Next.js 16.2",
			"Express 5",
			"React 19.2",
			"Prisma 7",
			"TypeScript",
			"MongoDB",
		],
		github: "https://github.com/Nishant-444/modern-web-boilerplate",
		thumb: [" my-app/", " ├ app/", " ├ prisma.config.ts", " └ package.json"],
	},
	{
		id: "bankease",
		name: "BankEase",
		status: "built",
		year: 2025,
		period: "2025",
		tagline:
			"C++ banking simulation engine that replaced text-file persistence with binary serialisation for a 300% throughput gain.",
		notes: [
			"Rewrote the storage layer from parsed text I/O to raw binary serialisation, achieving 300% faster read/write operations on account transactions.",
			"Structured the engine around SOLID OOP boundaries so accounts, transactions and persistence stay independently testable.",
		],
		stack: ["C++", "OOP", "Binary I/O", "Systems Programming"],
		github: "https://github.com/Nishant-444/BankEase",
		thumb: [
			" $ ./bankease --bench",
			" text   4.2 ms",
			" binary 1.0 ms",
			" +300%",
		],
	},
	{
		id: "portfolio",
		name: "Engineering Portfolio",
		short: "portfolio",
		status: "shipped",
		year: 2025,
		period: "2025 – Present",
		tagline:
			"The previous edition of this site — a quiet editorial portfolio built with Next.js 15, React 19, TypeScript and Tailwind CSS v4.",
		notes: [
			"Serif-led typography, a custom morphing cursor, blur-in scroll reveals, animated CSS-drawn project covers, a scroll-aware section rail, a built-in CLI drawer, and JSON-LD structured data.",
		],
		stack: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS", "SEO"],
		github: "https://github.com/Nishant-444/Portfolio",
		live: "https://nishantsharma.vercel.app/",
		liveLabel: "live",
		thumb: ["", "   Nishant Sharma", "   is an AI eng…", ""],
	},
];

const EXPERIENCE = [
	{
		when: "Jun 2026 – Present",
		where: "Jaipur, India",
		role: "AI/ML Engineer",
		org: "IterativeTech Research",
		url: "https://iterativetech.com/",
		current: true,
		notes: [
			"Building an agentic QA platform where AI agents generate, run and report software tests; all LLM inference runs locally via Ollama so code and test data never leave company infrastructure.",
			"Developing the TypeScript/Express backend and Next.js dashboard with guardrails: schema-validated JSON output and retry handling for unreliable local-model responses.",
		],
		tags: [
			"TypeScript",
			"Express",
			"Next.js",
			"Ollama",
			"LLM Agents",
			"Guardrails",
		],
	},
	{
		when: "Mar 2026 – Jun 2026",
		where: "Jaipur, India",
		role: "Software Engineer Intern",
		org: "Pratham Software (PSI)",
		url: "https://www.thepsi.com/",
		notes: [
			"Built a 3-layer Spring Boot + MySQL backend for an employee-appraisal platform with DTO-isolated API contracts and global exception handling.",
			"Secured it with Spring Security 6 + JWT RBAC (HR, Manager, Employee) and input validation that blocks privilege escalation.",
		],
		tags: ["Java", "Spring Boot", "Spring Security 6", "MySQL", "JWT"],
	},
	{
		when: "Aug 2024 – Jun 2027",
		where: "Jaipur, Rajasthan",
		role: "Bachelor of Computer Applications (BCA)",
		org: "S.S. Jain Subodh PG College",
		notes: [
			"GPA 8.3 / 10. Coursework: DBMS, Operating Systems, Computer Networking, Data Structures, Algorithms.",
		],
		tags: [],
	},
	{
		when: "Apr 2023 – May 2024",
		where: "Jaipur, Rajasthan",
		role: "Senior Secondary (XII) — Physics, Chemistry, Mathematics",
		org: "KPS Udaan",
		notes: ["Scored 90.2%."],
		tags: [],
	},
];

const HIGHLIGHTS = [
	{
		title: "Twice recommended by the Indian Air Force",
		text: "Cleared the 5-day SSB in 2024 and 2025 — a multi-stage assessment of leadership, psychology and decision-making under pressure.",
	},
	{
		title: "300+ algorithmic problems solved",
		text: "Across LeetCode, Codeforces and HackerRank, with a focus on time and space complexity.",
	},
	{
		title: "Open-source contributor",
		text: "Two PRs merged into ed-donner/llm_engineering (7k+ stars) totalling 1,400+ lines.",
	},
];

const OPEN_SOURCE = {
	repo: "ed-donner/llm_engineering",
	url: "https://github.com/ed-donner/llm_engineering",
	since: "Jun 2026 – Present",
	stars: "7k+",
	lines: "1,400+",
	prs: [
		{
			n: 3631,
			url: "https://github.com/ed-donner/llm_engineering/pull/3631",
			text: "Built an LLM cost meter that patches the OpenAI client in place to track tokens and spend across 8 providers.",
		},
		{
			n: 3492,
			url: "https://github.com/ed-donner/llm_engineering/pull/3492",
			text: "Shipped a local RAG course navigator with a Gradio UI — offline sentence-transformers embeddings and OpenRouter Q&A.",
		},
	],
};

const TOOLKIT = [
	{
		key: "genai",
		label: "GenAI & LLM",
		items: [
			"LLM Integration",
			"Prompt Engineering",
			"RAG",
			"Embeddings",
			"Vector Stores (pgvector)",
			"Agentic Workflows",
			"Guardrails",
			"LLM Cost Monitoring",
			"Whisper",
			"Ollama",
		],
	},
	{
		key: "backend",
		label: "Backend & APIs",
		items: [
			"Python (FastAPI)",
			"Java (Spring Boot, Spring Security)",
			"Node.js",
			"Express.js",
			"REST APIs",
			"JWT",
			"Microservices",
		],
	},
	{
		key: "frontend",
		label: "Frontend",
		items: [
			"React.js",
			"Next.js",
			"TypeScript",
			"JavaScript",
			"Tailwind",
			"HTML",
			"CSS",
		],
	},
	{
		key: "databases",
		label: "Databases",
		items: ["PostgreSQL", "MySQL", "pgvector", "Prisma ORM", "SQL"],
	},
	{
		key: "cloud",
		label: "Cloud & DevSecOps",
		items: [
			"AWS (EC2, RDS, S3)",
			"Docker",
			"CI/CD (GitHub Actions)",
			"Linux",
			"Secure Coding",
		],
	},
	{
		key: "practice",
		label: "Testing & Practices",
		items: ["Unit Testing", "Automated Testing", "Git", "System Design", "DSA"],
	},
];

const CERTS = [
	{
		name: "AI & ML Applications",
		by: "DoIT&C, Government of Rajasthan",
		when: "Oct 2026",
		url: "https://ai.rajasthan.gov.in/verify",
	},
	{
		name: "GitHub Foundations",
		by: "Microsoft",
		when: "Oct 2025",
		url: "https://learn.microsoft.com/en-gb/users/nishantsharma-2380/credentials/aefb5214ce0ab643",
	},
	{
		name: "Back End Development and APIs",
		by: "freeCodeCamp",
		when: "Oct 2025",
	},
	{
		name: "Problem Solving (Intermediate)",
		by: "HackerRank",
		when: "Jul 2025",
		url: "https://www.hackerrank.com/certificates/17f976a57553",
	},
	{
		name: "JavaScript Algorithms and Data Structures",
		by: "freeCodeCamp",
		when: "Jun 2025",
	},
	{ name: "Responsive Web Design", by: "freeCodeCamp", when: "Jun 2025" },
	{
		name: "SQL (Basic)",
		by: "HackerRank",
		when: "Mar 2025",
		url: "https://www.hackerrank.com/certificates/c3e4298b5e2e",
	},
];

const OFF_CLOCK = {
	intro:
		"Away from the keyboard I'm in the gym, running or cycling, playing volleyball and football, over a chessboard, at a synth, reading the classics — and sometimes writing poems.",
	groups: [
		{
			name: "moving",
			items: [
				[
					"gym",
					"Chasing the best of my physique and my mental health — and using both to achieve everything I want.",
				],
				["running", "Part of the same goal: a strong body and a clear head."],
				["cycling", "Same goal, on two wheels."],
				["volleyball", "I play opposite hitter."],
				["football", "I play in midfield."],
			],
		},
		{
			name: "thinking",
			items: [
				[
					"chess",
					"As White: the London System or the Queen's Gambit. As Black: the Caro-Kann or the King's Indian. Play me →",
					"https://www.chess.com/member/nishant_4712",
				],
				[
					"reading",
					"Classics. I recommend Crime and Punishment, To Kill a Mockingbird and 1984; currently reading Metamorphosis, White Nights and The Adventures of Sherlock Holmes.",
				],
			],
		},
		{
			name: "making",
			items: [
				[
					"synthesizer",
					"Playing since a summer camp in 5th grade — mostly Indian music, from patriotic songs to romantic ones.",
				],
				[
					"poetry",
					"Short poems in English, whatever comes to mind. On Substack →",
					"https://substack.com/@nishant4712",
				],
			],
		},
	],
};

/* Skill clusters for the stack.embed visualisation.
   Keys are normalised tag names (see norm() in app.js). */
const CLUSTERS = {
	ai: {
		label: "genai",
		tags: [
			"groq",
			"gemini",
			"ollama",
			"whisper",
			"rag",
			"embeddings",
			"vercel ai sdk",
			"guardrails",
			"llm agents",
			"agentic workflows",
			"prompt engineering",
			"llm cost monitoring",
		],
	},
	api: {
		label: "backend",
		tags: [
			"fastapi",
			"express",
			"node.js",
			"spring boot",
			"spring security",
			"nextauth",
			"better auth",
			"jwt",
			"zod",
			"resend",
			"appwrite",
			"rest apis",
			"microservices",
		],
	},
	ui: {
		label: "frontend",
		tags: [
			"react",
			"next.js",
			"tailwind",
			"vite",
			"dnd-kit",
			"html",
			"seo",
			"tmdb api",
		],
	},
	db: {
		label: "data",
		tags: [
			"postgresql",
			"pgvector",
			"mysql",
			"prisma",
			"mongodb",
			"neondb",
			"sql",
		],
	},
	ops: {
		label: "infra",
		tags: ["docker", "aws", "nginx", "github actions", "linux"],
	},
	lang: {
		label: "systems",
		tags: [
			"typescript",
			"javascript",
			"python",
			"java",
			"c++",
			"oop",
			"binary i/o",
			"systems programming",
		],
	},
};

/* Code shown in the nvim intro. Original snippets in the spirit of the projects above. */
const INTRO_FILES = [
	{
		repo: "Weave",
		path: "engine/router.py",
		lang: "python",
		url: "https://github.com/Nishant-444/Weave",
		code: `# dual-path retrieval: words go to vectors, numbers go to sql
from engine.llm import stream_with_failover
from engine.sandbox import guard_sql
from engine.store import vector_search, run_readonly

MUTATING = ("DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE", "CREATE")


async def answer(question: str, collection_id: str):
    route = await classify(question)

    if route == "tabular":
        sql = await draft_sql(question, collection_id)
        guard_sql(sql, forbid=MUTATING, tenant=collection_id)
        rows = await run_readonly(sql)
        # the model never does arithmetic. postgres does.
        yield cite(rows, source="sql", query=sql)
        return

    chunks = await vector_search(
        question,
        collection_id=collection_id,
        k=5,
        dims=384,
    )
    context = "\\n\\n".join(c.text for c in chunks)

    # check quota *before* opening the stream:
    # a 429 halfway through is a broken answer
    async for token in stream_with_failover(
        providers=["gemini", "groq"],
        prompt=build_prompt(question, context),
    ):
        yield token

    yield cite(chunks, source="semantic")`,
	},
	{
		repo: "VizTube",
		path: "src/rag/retrieve.ts",
		lang: "js",
		url: "https://github.com/Nishant-444/VizTube",
		code: `// ask any video: transcript -> embeddings -> pgvector -> cited answer
import { prisma } from "../db";
import { embed } from "./embed";
import { groq } from "../llm";

const TOP_K = 5;

export async function askVideo(videoId: string, question: string) {
  const vector = await embed(question); // 384-dim, runs locally

  const chunks = await prisma.$queryRaw<Chunk[]>\`
    SELECT text, start_sec, end_sec
    FROM transcript_chunks
    WHERE video_id = \${videoId}::uuid
    ORDER BY embedding <=> \${vector}::vector
    LIMIT \${TOP_K}
  \`;

  if (chunks.length === 0) {
    return { answer: "No transcript yet.", sources: [] };
  }

  const answer = await groq.chat({
    system: "Answer only from the transcript. Cite timestamps.",
    context: chunks.map(toCitedLine).join("\\n"),
    question,
  });

  return {
    answer,
    sources: chunks.map((c) => ({ at: c.start_sec, text: c.text })),
  };
}`,
	},
	{
		repo: "job_application_tracker",
		path: "lib/order.ts",
		lang: "js",
		url: "https://github.com/Nishant-444/job_application_tracker",
		code: `// O(1) reorder: write one row, never renumber the column
const GAP = 1024;
const EPSILON = 1e-6;

export function positionBetween(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) return GAP;
  if (prev === undefined) return next! / 2;
  if (next === undefined) return prev + GAP;
  return (prev + next) / 2;
}

export async function moveCard(id: string, stageId: string, prev?: Card, next?: Card) {
  const position = positionBetween(prev?.position, next?.position);

  // optimistic: the board already moved, this just agrees with it
  await db.application.update({
    where: { id },
    data: { stageId, position },
  });

  if (needsRebalance(prev?.position, next?.position)) {
    await rebalance(stageId); // rare: the floats ran out of room
  }
}

function needsRebalance(a?: number, b?: number) {
  return a !== undefined && b !== undefined && Math.abs(b - a) < EPSILON;
}`,
	},
];

/* Lines "typed" in INSERT mode during the intro. */
const INTRO_INSERTS = [
	"// make it work, make it honest, then make it fast.",
	"// every answer cites its source, or it doesn't ship.",
	"// small servers, big ideas.",
];

/* GitHub: live numbers are fetched at runtime from the public API.
   These are the fallbacks (and the contribution calendar, which the API doesn't expose). */
const GITHUB = {
	user: "Nishant-444",
	fallback: { followers: 7, repos: 53, stars: 124 },
	contributions: {
		total: 1580,
		from: "2025-11-09",
		to: "2026-11-13",
		weekly: [
			46, 18, 26, 49, 25, 49, 44, 28, 52, 18, 13, 26, 65, 32, 15, 39, 26, 38,
			24, 14, 4, 34, 16, 34, 17, 16, 22, 16, 13, 11, 28, 40, 43, 47, 10, 36, 87,
			23, 39, 18, 18, 13, 17, 54, 18, 23, 26, 10, 26, 31, 65, 46, 32,
		],
	},
};

/* Screenshots shown on the wheel cards and in `ls shots/` (first one is the card image).
   Live sites where they exist, otherwise the GitHub repo page and its README. */
const SHOTS = {
	viztube: ["assets/shots/viztube-1.webp", "assets/shots/viztube-2.webp"],
	weave: ["assets/shots/weave-1.webp", "assets/shots/weave-2.webp"],
	echoinbox: ["assets/shots/echoinbox-1.webp"],
	jobtrack: ["assets/shots/jobtrack-2.webp", "assets/shots/jobtrack-1.webp"],
	appraisehub: ["assets/shots/appraisehub-1.webp"],
	"trend-engine": [
		"assets/shots/trend-engine-1.webp",
		"assets/shots/trend-engine-2.webp",
	],
	"modern-web-boilerplate": [
		"assets/shots/modern-web-boilerplate-1.webp",
		"assets/shots/modern-web-boilerplate-2.webp",
	],
	bankease: ["assets/shots/bankease-1.webp", "assets/shots/bankease-2.webp"],
	portfolio: ["assets/shots/portfolio-1.webp", "assets/shots/portfolio-2.webp"],
};

/* More code for the intro wall. */
INTRO_FILES.push(
	{
		repo: "BankEase",
		path: "src/storage.cpp",
		lang: "c",
		url: "https://github.com/Nishant-444/BankEase",
		code: `// binary persistence: 4.2 ms of parsing became 1.0 ms of memcpy
#include "storage.h"
#include <fstream>

namespace bank {

bool Storage::save(const std::vector<Account>& accounts) const {
  std::ofstream out(path_, std::ios::binary | std::ios::trunc);
  if (!out) return false;
  const std::uint32_t count = static_cast<std::uint32_t>(accounts.size());
  out.write(reinterpret_cast<const char*>(&count), sizeof count);
  for (const Account& a : accounts) {
    out.write(reinterpret_cast<const char*>(&a.record()), sizeof(Record));
  }
  return out.good();
}

std::vector<Account> Storage::load() const {
  std::ifstream in(path_, std::ios::binary);
  std::vector<Account> accounts;
  std::uint32_t count = 0;
  if (!in.read(reinterpret_cast<char*>(&count), sizeof count)) return accounts;
  accounts.reserve(count);
  Record r{};
  while (count-- && in.read(reinterpret_cast<char*>(&r), sizeof r)) {
    accounts.emplace_back(r);
  }
  return accounts;
}

}  // namespace bank`,
	},
	{
		repo: "AppraiseHub",
		path: "security/SecurityConfig.java",
		lang: "js",
		url: "https://github.com/Nishant-444/AppraiseHub",
		code: `// three actors, one gate: HR, manager, employee
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  private final JwtFilter jwtFilter;

  public SecurityConfig(JwtFilter jwtFilter) {
    this.jwtFilter = jwtFilter;
  }

  @Bean
  SecurityFilterChain chain(HttpSecurity http) throws Exception {
    return http
      .csrf(csrf -> csrf.disable())
      .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/api/auth/**").permitAll()
        .requestMatchers("/api/hr/**").hasRole("HR")
        .requestMatchers("/api/reviews/approve/**").hasAnyRole("MANAGER", "HR")
        .anyRequest().authenticated())
      .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
      .build();
  }
}`,
	},
);
INTRO_FILES.forEach((f) => {
	f.firstLine = 1;
	f.lines = f.code.split("\n");
});

/* What the ghost types into the code in the intro (two beats), and the footer note. */
const INTRO = {
	messages: [
		["every answer", "cites its source,", "or it doesn't ship."],
		["small servers,", "honest models,", "big ideas."],
	],
	note: "// shipping LLMs to production.",
};
