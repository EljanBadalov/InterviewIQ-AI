import dns from "node:dns";

import mongoose from "mongoose";

import {
  env,
} from "../config/env";

import ATSCompany, {
  type ATSProvider,
} from "../models/ATSCompany";

/* =========================================================
   NODE DNS

   Windows/router DNS can resolve MongoDB SRV via nslookup
   while Node's resolver still fails with ECONNREFUSED.
========================================================= */

dns.setServers([
  "1.1.1.1",
  "8.8.8.8",
]);

/* =========================================================
   TYPES
========================================================= */

interface ISeedATSCompany {
  companyName: string;

  ats: ATSProvider;

  boardSlug: string;

  careersUrl: string;

  priority: number;
}

interface IValidationResult {
  valid: boolean;

  jobCount: number;
}

/* =========================================================
   GOALS
========================================================= */

const MINIMUM_ACTIVE_PER_PROVIDER =
  30;

/*
 * Local SuccessFactors coverage starts with real companies we
 * can verify individually. We do not require 30 companies for
 * this provider during the initial Azerbaijan rollout.
 */
const MINIMUM_ACTIVE_SUCCESSFACTORS =
  1;

const FETCH_TIMEOUT_MS =
  12_000;

const VALIDATION_CONCURRENCY =
  4;

/* =========================================================
   CANDIDATE REGISTRY

   Important:
   - This is a discovery/seed candidate list.
   - Every entry is checked against the provider's public API
     before it is written to MongoDB.
   - Invalid, moved, private, or closed boards are skipped.
   - The script reports whether each provider reached 30+
     active companies after validation.
========================================================= */

const GREENHOUSE_COMPANIES:
  ISeedATSCompany[] = [
    {
      companyName: "Figma",
      ats: "greenhouse",
      boardSlug: "figma",
      careersUrl: "https://job-boards.greenhouse.io/figma",
      priority: 100,
    },
    {
      companyName: "Cloudflare",
      ats: "greenhouse",
      boardSlug: "cloudflare",
      careersUrl: "https://job-boards.greenhouse.io/cloudflare",
      priority: 100,
    },
    {
      companyName: "Postman",
      ats: "greenhouse",
      boardSlug: "postman",
      careersUrl: "https://job-boards.greenhouse.io/postman",
      priority: 100,
    },
    {
      companyName: "Anduril Industries",
      ats: "greenhouse",
      boardSlug: "andurilindustries",
      careersUrl: "https://job-boards.greenhouse.io/andurilindustries",
      priority: 100,
    },
    {
      companyName: "Vercel",
      ats: "greenhouse",
      boardSlug: "vercel",
      careersUrl: "https://job-boards.greenhouse.io/vercel",
      priority: 100,
    },
    {
      companyName: "CLEAR",
      ats: "greenhouse",
      boardSlug: "clear",
      careersUrl: "https://job-boards.greenhouse.io/clear",
      priority: 95,
    },
    {
      companyName: "Oklo",
      ats: "greenhouse",
      boardSlug: "oklo",
      careersUrl: "https://job-boards.greenhouse.io/oklo",
      priority: 95,
    },
    {
      companyName: "Graphcore",
      ats: "greenhouse",
      boardSlug: "graphcore",
      careersUrl: "https://job-boards.greenhouse.io/graphcore",
      priority: 95,
    },
    {
      companyName: "Diligent",
      ats: "greenhouse",
      boardSlug: "diligentcorporation",
      careersUrl: "https://job-boards.greenhouse.io/diligentcorporation",
      priority: 95,
    },
    {
      companyName: "Outschool",
      ats: "greenhouse",
      boardSlug: "outschool",
      careersUrl: "https://job-boards.greenhouse.io/outschool",
      priority: 90,
    },
    {
      companyName: "CaseGuard",
      ats: "greenhouse",
      boardSlug: "caseguard",
      careersUrl: "https://job-boards.greenhouse.io/caseguard",
      priority: 90,
    },
    {
      companyName: "Redwood Software",
      ats: "greenhouse",
      boardSlug: "redwoodsoftware",
      careersUrl: "https://job-boards.greenhouse.io/redwoodsoftware",
      priority: 95,
    },
    {
      companyName: "NinjaTrader",
      ats: "greenhouse",
      boardSlug: "ninjatrader",
      careersUrl: "https://job-boards.greenhouse.io/ninjatrader",
      priority: 95,
    },
    {
      companyName: "Alarm.com",
      ats: "greenhouse",
      boardSlug: "alarmcom",
      careersUrl: "https://job-boards.greenhouse.io/alarmcom",
      priority: 90,
    },
    {
      companyName: "Pearl / JustAnswer",
      ats: "greenhouse",
      boardSlug: "justanswer",
      careersUrl: "https://job-boards.greenhouse.io/justanswer",
      priority: 90,
    },
    {
      companyName: "Ledgy",
      ats: "greenhouse",
      boardSlug: "ledgy",
      careersUrl: "https://job-boards.greenhouse.io/ledgy",
      priority: 90,
    },
    {
      companyName: "Fleetworthy",
      ats: "greenhouse",
      boardSlug: "bestpass",
      careersUrl: "https://job-boards.greenhouse.io/bestpass",
      priority: 85,
    },
    {
      companyName: "Ever",
      ats: "greenhouse",
      boardSlug: "ever",
      careersUrl: "https://job-boards.greenhouse.io/ever",
      priority: 90,
    },
    {
      companyName: "Reddit",
      ats: "greenhouse",
      boardSlug: "reddit",
      careersUrl: "https://job-boards.greenhouse.io/reddit",
      priority: 100,
    },
    {
      companyName: "Discord",
      ats: "greenhouse",
      boardSlug: "discord",
      careersUrl: "https://job-boards.greenhouse.io/discord",
      priority: 100,
    },
    {
      companyName: "Coinbase",
      ats: "greenhouse",
      boardSlug: "coinbase",
      careersUrl: "https://job-boards.greenhouse.io/coinbase",
      priority: 100,
    },
    {
      companyName: "Scale AI",
      ats: "greenhouse",
      boardSlug: "scaleai",
      careersUrl: "https://job-boards.greenhouse.io/scaleai",
      priority: 100,
    },
    {
      companyName: "Stripe",
      ats: "greenhouse",
      boardSlug: "stripe",
      careersUrl: "https://job-boards.greenhouse.io/stripe",
      priority: 100,
    },
    {
      companyName: "Databricks",
      ats: "greenhouse",
      boardSlug: "databricks",
      careersUrl: "https://job-boards.greenhouse.io/databricks",
      priority: 100,
    },
    {
      companyName: "Plaid",
      ats: "greenhouse",
      boardSlug: "plaid",
      careersUrl: "https://job-boards.greenhouse.io/plaid",
      priority: 95,
    },
    {
      companyName: "Twilio",
      ats: "greenhouse",
      boardSlug: "twilio",
      careersUrl: "https://job-boards.greenhouse.io/twilio",
      priority: 95,
    },
    {
      companyName: "Flexport",
      ats: "greenhouse",
      boardSlug: "flexport",
      careersUrl: "https://job-boards.greenhouse.io/flexport",
      priority: 90,
    },
    {
      companyName: "Dropbox",
      ats: "greenhouse",
      boardSlug: "dropbox",
      careersUrl: "https://job-boards.greenhouse.io/dropbox",
      priority: 95,
    },
    {
      companyName: "Affirm",
      ats: "greenhouse",
      boardSlug: "affirm",
      careersUrl: "https://job-boards.greenhouse.io/affirm",
      priority: 95,
    },
    {
      companyName: "GitLab",
      ats: "greenhouse",
      boardSlug: "gitlab",
      careersUrl: "https://job-boards.greenhouse.io/gitlab",
      priority: 95,
    },
    {
      companyName: "Samsara",
      ats: "greenhouse",
      boardSlug: "samsara",
      careersUrl: "https://job-boards.greenhouse.io/samsara",
      priority: 95,
    },
    {
      companyName: "Benchling",
      ats: "greenhouse",
      boardSlug: "benchling",
      careersUrl: "https://job-boards.greenhouse.io/benchling",
      priority: 90,
    },
    {
      companyName: "Highspot",
      ats: "greenhouse",
      boardSlug: "highspot",
      careersUrl: "https://job-boards.greenhouse.io/highspot",
      priority: 90,
    },
    {
      companyName: "Webflow",
      ats: "greenhouse",
      boardSlug: "webflow",
      careersUrl: "https://job-boards.greenhouse.io/webflow",
      priority: 95,
    },
    {
      companyName: "Grammarly",
      ats: "greenhouse",
      boardSlug: "grammarly",
      careersUrl: "https://job-boards.greenhouse.io/grammarly",
      priority: 95,
    },
    {
      companyName: "Asana",
      ats: "greenhouse",
      boardSlug: "asana",
      careersUrl: "https://job-boards.greenhouse.io/asana",
      priority: 95,
    },
    {
      companyName: "Brex",
      ats: "greenhouse",
      boardSlug: "brex",
      careersUrl: "https://job-boards.greenhouse.io/brex",
      priority: 95,
    },
    {
      companyName: "Ramp",
      ats: "greenhouse",
      boardSlug: "ramp",
      careersUrl: "https://job-boards.greenhouse.io/ramp",
      priority: 95,
    },
    {
      companyName: "Rippling",
      ats: "greenhouse",
      boardSlug: "rippling",
      careersUrl: "https://job-boards.greenhouse.io/rippling",
      priority: 95,
    },
    {
      companyName: "MongoDB",
      ats: "greenhouse",
      boardSlug: "mongodb",
      careersUrl: "https://job-boards.greenhouse.io/mongodb",
      priority: 95,
    },
    {
      companyName: "Cockroach Labs",
      ats: "greenhouse",
      boardSlug: "cockroachlabs",
      careersUrl: "https://job-boards.greenhouse.io/cockroachlabs",
      priority: 90,
    },
    {
      companyName: "Confluent",
      ats: "greenhouse",
      boardSlug: "confluent",
      careersUrl: "https://job-boards.greenhouse.io/confluent",
      priority: 95,
    },
    {
      companyName: "HashiCorp",
      ats: "greenhouse",
      boardSlug: "hashicorp",
      careersUrl: "https://job-boards.greenhouse.io/hashicorp",
      priority: 95,
    },
    {
      companyName: "Datadog",
      ats: "greenhouse",
      boardSlug: "datadog",
      careersUrl: "https://job-boards.greenhouse.io/datadog",
      priority: 95,
    },
    {
      companyName: "Fastly",
      ats: "greenhouse",
      boardSlug: "fastly",
      careersUrl: "https://job-boards.greenhouse.io/fastly",
      priority: 90,
    },
  ];

const LEVER_COMPANIES:
  ISeedATSCompany[] = [
    {
      companyName: "Xsolla",
      ats: "lever",
      boardSlug: "xsolla",
      careersUrl: "https://jobs.lever.co/xsolla",
      priority: 100,
    },
    {
      companyName: "BrightEdge",
      ats: "lever",
      boardSlug: "brightedge",
      careersUrl: "https://jobs.lever.co/brightedge",
      priority: 90,
    },
    {
      companyName: "Zencore",
      ats: "lever",
      boardSlug: "zencore",
      careersUrl: "https://jobs.lever.co/zencore",
      priority: 90,
    },
    {
      companyName: "Brilliant",
      ats: "lever",
      boardSlug: "brilliant",
      careersUrl: "https://jobs.lever.co/brilliant",
      priority: 90,
    },
    {
      companyName: "Findigs",
      ats: "lever",
      boardSlug: "findigs",
      careersUrl: "https://jobs.lever.co/findigs",
      priority: 90,
    },
    {
      companyName: "Reply",
      ats: "lever",
      boardSlug: "reply",
      careersUrl: "https://jobs.lever.co/reply",
      priority: 85,
    },
    {
      companyName: "Employ",
      ats: "lever",
      boardSlug: "employ",
      careersUrl: "https://jobs.lever.co/employ",
      priority: 85,
    },
    {
      companyName: "Arcadia",
      ats: "lever",
      boardSlug: "arcadia",
      careersUrl: "https://jobs.lever.co/arcadia",
      priority: 90,
    },
    {
      companyName: "Reveal Technology",
      ats: "lever",
      boardSlug: "revealtech",
      careersUrl: "https://jobs.lever.co/revealtech",
      priority: 90,
    },
    {
      companyName: "Corbalt",
      ats: "lever",
      boardSlug: "corbalt",
      careersUrl: "https://jobs.lever.co/corbalt",
      priority: 85,
    },
    {
      companyName: "Smart Working Solutions",
      ats: "lever",
      boardSlug: "smart-working-solutions",
      careersUrl: "https://jobs.lever.co/smart-working-solutions",
      priority: 85,
    },
    {
      companyName: "Legend",
      ats: "lever",
      boardSlug: "Legend",
      careersUrl: "https://jobs.lever.co/Legend",
      priority: 80,
    },
    {
      companyName: "WISEcode",
      ats: "lever",
      boardSlug: "wisecode",
      careersUrl: "https://jobs.lever.co/wisecode",
      priority: 80,
    },
    {
      companyName: "Dun & Bradstreet",
      ats: "lever",
      boardSlug: "dnb",
      careersUrl: "https://jobs.lever.co/dnb",
      priority: 100,
    },
    {
      companyName: "Aleph",
      ats: "lever",
      boardSlug: "aleph",
      careersUrl: "https://jobs.lever.co/aleph",
      priority: 95,
    },
    {
      companyName: "Highwire",
      ats: "lever",
      boardSlug: "highwire",
      careersUrl: "https://jobs.lever.co/highwire",
      priority: 85,
    },
    {
      companyName: "HighLevel",
      ats: "lever",
      boardSlug: "highlevel",
      careersUrl: "https://jobs.lever.co/highlevel",
      priority: 90,
    },
    {
      companyName: "EvenUp",
      ats: "lever",
      boardSlug: "evenup",
      careersUrl: "https://jobs.lever.co/evenup",
      priority: 95,
    },
    {
      companyName: "Level AI",
      ats: "lever",
      boardSlug: "levelai",
      careersUrl: "https://jobs.lever.co/levelai",
      priority: 90,
    },
    {
      companyName: "Appcues",
      ats: "lever",
      boardSlug: "appcues",
      careersUrl: "https://jobs.lever.co/appcues",
      priority: 85,
    },
    {
      companyName: "Mux",
      ats: "lever",
      boardSlug: "mux",
      careersUrl: "https://jobs.lever.co/mux",
      priority: 95,
    },
    {
      companyName: "Sourcegraph",
      ats: "lever",
      boardSlug: "sourcegraph",
      careersUrl: "https://jobs.lever.co/sourcegraph",
      priority: 95,
    },
    {
      companyName: "Grafana Labs",
      ats: "lever",
      boardSlug: "grafanalabs",
      careersUrl: "https://jobs.lever.co/grafanalabs",
      priority: 95,
    },
    {
      companyName: "Netlify",
      ats: "lever",
      boardSlug: "netlify",
      careersUrl: "https://jobs.lever.co/netlify",
      priority: 95,
    },
    {
      companyName: "Docker",
      ats: "lever",
      boardSlug: "docker",
      careersUrl: "https://jobs.lever.co/docker",
      priority: 95,
    },
    {
      companyName: "Canva",
      ats: "lever",
      boardSlug: "canva",
      careersUrl: "https://jobs.lever.co/canva",
      priority: 95,
    },
    {
      companyName: "Palantir",
      ats: "lever",
      boardSlug: "palantir",
      careersUrl: "https://jobs.lever.co/palantir",
      priority: 100,
    },
    {
      companyName: "Kraken",
      ats: "lever",
      boardSlug: "kraken",
      careersUrl: "https://jobs.lever.co/kraken",
      priority: 95,
    },
    {
      companyName: "Consensys",
      ats: "lever",
      boardSlug: "consensys",
      careersUrl: "https://jobs.lever.co/consensys",
      priority: 90,
    },
    {
      companyName: "Chainlink Labs",
      ats: "lever",
      boardSlug: "chainlink",
      careersUrl: "https://jobs.lever.co/chainlink",
      priority: 95,
    },
    {
      companyName: "BitGo",
      ats: "lever",
      boardSlug: "bitgo",
      careersUrl: "https://jobs.lever.co/bitgo",
      priority: 90,
    },
    {
      companyName: "Binance",
      ats: "lever",
      boardSlug: "binance",
      careersUrl: "https://jobs.lever.co/binance",
      priority: 100,
    },
    {
      companyName: "Robinhood",
      ats: "lever",
      boardSlug: "robinhood",
      careersUrl: "https://jobs.lever.co/robinhood",
      priority: 95,
    },
    {
      companyName: "Coursera",
      ats: "lever",
      boardSlug: "coursera",
      careersUrl: "https://jobs.lever.co/coursera",
      priority: 90,
    },
    {
      companyName: "Udacity",
      ats: "lever",
      boardSlug: "udacity",
      careersUrl: "https://jobs.lever.co/udacity",
      priority: 85,
    },
    {
      companyName: "Miro",
      ats: "lever",
      boardSlug: "miro",
      careersUrl: "https://jobs.lever.co/miro",
      priority: 95,
    },
    {
      companyName: "Zapier",
      ats: "lever",
      boardSlug: "zapier",
      careersUrl: "https://jobs.lever.co/zapier",
      priority: 95,
    },
    {
      companyName: "Lattice",
      ats: "lever",
      boardSlug: "lattice",
      careersUrl: "https://jobs.lever.co/lattice",
      priority: 90,
    },
    {
      companyName: "Rippling",
      ats: "lever",
      boardSlug: "rippling",
      careersUrl: "https://jobs.lever.co/rippling",
      priority: 90,
    },
    {
      companyName: "Elastic",
      ats: "lever",
      boardSlug: "elastic",
      careersUrl: "https://jobs.lever.co/elastic",
      priority: 95,
    },
    {
      companyName: "Canonical",
      ats: "lever",
      boardSlug: "canonical",
      careersUrl: "https://jobs.lever.co/canonical",
      priority: 95,
    },
    {
      companyName: "Celonis",
      ats: "lever",
      boardSlug: "celonis",
      careersUrl: "https://jobs.lever.co/celonis",
      priority: 90,
    },
    {
      companyName: "dLocal",
      ats: "lever",
      boardSlug: "dlocal",
      careersUrl: "https://jobs.lever.co/dlocal",
      priority: 90,
    },
    {
      companyName: "Bird",
      ats: "lever",
      boardSlug: "bird",
      careersUrl: "https://jobs.lever.co/bird",
      priority: 85,
    },
    {
      companyName: "Nimble",
      ats: "lever",
      boardSlug: "nimble",
      careersUrl: "https://jobs.lever.co/nimble",
      priority: 80,
    },
    {
      companyName: "Pattern",
      ats: "lever",
      boardSlug: "pattern",
      careersUrl: "https://jobs.lever.co/pattern",
      priority: 85,
    },
  ];

const ASHBY_COMPANIES:
  ISeedATSCompany[] = [
    {
      companyName: "Ashby",
      ats: "ashby",
      boardSlug: "ashby",
      careersUrl: "https://jobs.ashbyhq.com/ashby",
      priority: 100,
    },
    {
      companyName: "Supabase",
      ats: "ashby",
      boardSlug: "supabase",
      careersUrl: "https://jobs.ashbyhq.com/supabase",
      priority: 100,
    },
    {
      companyName: "Tekion",
      ats: "ashby",
      boardSlug: "tekion",
      careersUrl: "https://jobs.ashbyhq.com/tekion",
      priority: 100,
    },
    {
      companyName: "MaintainX",
      ats: "ashby",
      boardSlug: "maintainx",
      careersUrl: "https://jobs.ashbyhq.com/maintainx",
      priority: 100,
    },
    {
      companyName: "Zafran Security",
      ats: "ashby",
      boardSlug: "zafran-security",
      careersUrl: "https://jobs.ashbyhq.com/zafran-security",
      priority: 95,
    },
    {
      companyName: "Beyond Sports",
      ats: "ashby",
      boardSlug: "wearebeyondsports",
      careersUrl: "https://jobs.ashbyhq.com/wearebeyondsports",
      priority: 90,
    },
    {
      companyName: "Worktrace AI",
      ats: "ashby",
      boardSlug: "Worktrace AI",
      careersUrl: "https://jobs.ashbyhq.com/Worktrace%20AI",
      priority: 90,
    },
    {
      companyName: "Whetstone Research",
      ats: "ashby",
      boardSlug: "whetstoneresearch",
      careersUrl: "https://jobs.ashbyhq.com/whetstoneresearch",
      priority: 90,
    },
    {
      companyName: "Almedia",
      ats: "ashby",
      boardSlug: "almedia",
      careersUrl: "https://jobs.ashbyhq.com/almedia",
      priority: 90,
    },
    {
      companyName: "Bifrost AI",
      ats: "ashby",
      boardSlug: "Bifrost",
      careersUrl: "https://jobs.ashbyhq.com/Bifrost",
      priority: 90,
    },
    {
      companyName: "Geo Browser",
      ats: "ashby",
      boardSlug: "geobrowser",
      careersUrl: "https://jobs.ashbyhq.com/geobrowser",
      priority: 85,
    },
    {
      companyName: "Fabrion",
      ats: "ashby",
      boardSlug: "fabrion",
      careersUrl: "https://jobs.ashbyhq.com/fabrion",
      priority: 85,
    },
    {
      companyName: "Loora",
      ats: "ashby",
      boardSlug: "loora",
      careersUrl: "https://jobs.ashbyhq.com/loora",
      priority: 90,
    },
    {
      companyName: "Nebex",
      ats: "ashby",
      boardSlug: "nebex",
      careersUrl: "https://jobs.ashbyhq.com/nebex",
      priority: 85,
    },
    {
      companyName: "Sarvam",
      ats: "ashby",
      boardSlug: "sarvam",
      careersUrl: "https://jobs.ashbyhq.com/sarvam",
      priority: 95,
    },
    {
      companyName: "White Circle",
      ats: "ashby",
      boardSlug: "whitecircle",
      careersUrl: "https://jobs.ashbyhq.com/whitecircle",
      priority: 85,
    },
    {
      companyName: "Paymentology",
      ats: "ashby",
      boardSlug: "paymentology",
      careersUrl: "https://jobs.ashbyhq.com/paymentology",
      priority: 90,
    },
    {
      companyName: "Spector.ai",
      ats: "ashby",
      boardSlug: "spector-ai",
      careersUrl: "https://jobs.ashbyhq.com/spector-ai",
      priority: 85,
    },
    {
      companyName: "Second Front Systems",
      ats: "ashby",
      boardSlug: "second-front-systems",
      careersUrl: "https://jobs.ashbyhq.com/second-front-systems",
      priority: 90,
    },
    {
      companyName: "ARB Interactive",
      ats: "ashby",
      boardSlug: "arb-interactive",
      careersUrl: "https://jobs.ashbyhq.com/arb-interactive",
      priority: 90,
    },
    {
      companyName: "TAR",
      ats: "ashby",
      boardSlug: "tar",
      careersUrl: "https://jobs.ashbyhq.com/tar",
      priority: 85,
    },
    {
      companyName: "Tsenta",
      ats: "ashby",
      boardSlug: "Tsenta",
      careersUrl: "https://jobs.ashbyhq.com/Tsenta",
      priority: 80,
    },
    {
      companyName: "Sazabi",
      ats: "ashby",
      boardSlug: "sazabi",
      careersUrl: "https://jobs.ashbyhq.com/sazabi",
      priority: 80,
    },
    {
      companyName: "Swarmer",
      ats: "ashby",
      boardSlug: "swarmer",
      careersUrl: "https://jobs.ashbyhq.com/swarmer",
      priority: 85,
    },
    {
      companyName: "Melius",
      ats: "ashby",
      boardSlug: "melius",
      careersUrl: "https://jobs.ashbyhq.com/melius",
      priority: 80,
    },
    {
      companyName: "Linear",
      ats: "ashby",
      boardSlug: "linear",
      careersUrl: "https://jobs.ashbyhq.com/linear",
      priority: 100,
    },
    {
      companyName: "Notion",
      ats: "ashby",
      boardSlug: "notion",
      careersUrl: "https://jobs.ashbyhq.com/notion",
      priority: 100,
    },
    {
      companyName: "Vanta",
      ats: "ashby",
      boardSlug: "vanta",
      careersUrl: "https://jobs.ashbyhq.com/vanta",
      priority: 95,
    },
    {
      companyName: "Ramp",
      ats: "ashby",
      boardSlug: "ramp",
      careersUrl: "https://jobs.ashbyhq.com/ramp",
      priority: 95,
    },
    {
      companyName: "Deel",
      ats: "ashby",
      boardSlug: "deel",
      careersUrl: "https://jobs.ashbyhq.com/deel",
      priority: 95,
    },
    {
      companyName: "Retool",
      ats: "ashby",
      boardSlug: "retool",
      careersUrl: "https://jobs.ashbyhq.com/retool",
      priority: 95,
    },
    {
      companyName: "Mercury",
      ats: "ashby",
      boardSlug: "mercury",
      careersUrl: "https://jobs.ashbyhq.com/mercury",
      priority: 95,
    },
    {
      companyName: "Perplexity",
      ats: "ashby",
      boardSlug: "perplexity",
      careersUrl: "https://jobs.ashbyhq.com/perplexity",
      priority: 100,
    },
    {
      companyName: "Cursor",
      ats: "ashby",
      boardSlug: "cursor",
      careersUrl: "https://jobs.ashbyhq.com/cursor",
      priority: 100,
    },
    {
      companyName: "Harvey",
      ats: "ashby",
      boardSlug: "harvey",
      careersUrl: "https://jobs.ashbyhq.com/harvey",
      priority: 95,
    },
    {
      companyName: "OpenRouter",
      ats: "ashby",
      boardSlug: "openrouter",
      careersUrl: "https://jobs.ashbyhq.com/openrouter",
      priority: 95,
    },
    {
      companyName: "ElevenLabs",
      ats: "ashby",
      boardSlug: "elevenlabs",
      careersUrl: "https://jobs.ashbyhq.com/elevenlabs",
      priority: 100,
    },
    {
      companyName: "Pylon",
      ats: "ashby",
      boardSlug: "pylon",
      careersUrl: "https://jobs.ashbyhq.com/pylon",
      priority: 90,
    },
    {
      companyName: "Modal",
      ats: "ashby",
      boardSlug: "modal",
      careersUrl: "https://jobs.ashbyhq.com/modal",
      priority: 95,
    },
    {
      companyName: "Sierra",
      ats: "ashby",
      boardSlug: "sierra",
      careersUrl: "https://jobs.ashbyhq.com/sierra",
      priority: 95,
    },
    {
      companyName: "Decagon",
      ats: "ashby",
      boardSlug: "decagon",
      careersUrl: "https://jobs.ashbyhq.com/decagon",
      priority: 95,
    },
    {
      companyName: "LangChain",
      ats: "ashby",
      boardSlug: "langchain",
      careersUrl: "https://jobs.ashbyhq.com/langchain",
      priority: 95,
    },
    {
      companyName: "Together AI",
      ats: "ashby",
      boardSlug: "togetherai",
      careersUrl: "https://jobs.ashbyhq.com/togetherai",
      priority: 95,
    },
    {
      companyName: "Baseten",
      ats: "ashby",
      boardSlug: "baseten",
      careersUrl: "https://jobs.ashbyhq.com/baseten",
      priority: 95,
    },
    {
      companyName: "Pinecone",
      ats: "ashby",
      boardSlug: "pinecone",
      careersUrl: "https://jobs.ashbyhq.com/pinecone",
      priority: 95,
    },
    {
      companyName: "Weights & Biases",
      ats: "ashby",
      boardSlug: "wandb",
      careersUrl: "https://jobs.ashbyhq.com/wandb",
      priority: 95,
    },
  ];

const SUCCESSFACTORS_COMPANIES:
  ISeedATSCompany[] = [
    {
      companyName:
        "Azercell Telecom LLC",

      ats:
        "successfactors",

      /*
       * For SuccessFactors, boardSlug is a stable registry key.
       * externalJobService uses careersUrl as the public source.
       */
      boardSlug:
        "azercell",

      careersUrl:
        "https://careers.azercell.com",

      priority:
        100,
    },
  ];

const ATS_COMPANIES:
  ISeedATSCompany[] = [
    ...GREENHOUSE_COMPANIES,
    ...LEVER_COMPANIES,
    ...ASHBY_COMPANIES,
    ...SUCCESSFACTORS_COMPANIES,
  ];

/* =========================================================
   FETCH
========================================================= */

const fetchJson = async (
  url:
    string
): Promise<unknown> => {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      FETCH_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "InterviewIQ-ATS-Registry/1.0",
          },

          signal:
            controller.signal,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(
      timeout
    );
  }
};

const fetchText = async (
  url:
    string
): Promise<string> => {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      FETCH_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "text/html,application/xhtml+xml",

            "User-Agent":
              "InterviewIQ-ATS-Registry/1.0",
          },

          redirect:
            "follow",

          signal:
            controller.signal,
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.text();
  } finally {
    clearTimeout(
      timeout
    );
  }
};

/* =========================================================
   SUCCESSFACTORS VALIDATION HELPERS
========================================================= */

const normalizeUrl = (
  value:
    string
): string => {
  return value
    .trim()
    .replace(
      /\/$/,
      ""
    );
};

const extractSuccessFactorsJobLinks = (
  html:
    string,
  baseUrl:
    string
): string[] => {
  const links =
    new Set<string>();

  const regex =
    /href=["']([^"']*\/job\/[^"']*\/\d+\/?(?:\?[^"']*)?)["']/gi;

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        regex.exec(
          html
        )
    ) !==
    null
  ) {
    const href =
      match[
        1
      ] ||
      "";

    try {
      links.add(
        new URL(
          href,
          baseUrl
        ).toString()
      );
    } catch {
      // Ignore malformed hrefs.
    }
  }

  return [
    ...links,
  ];
};

/* =========================================================
   PROVIDER VALIDATION
========================================================= */

const validateGreenhouseBoard =
  async (
    boardSlug:
      string
  ): Promise<IValidationResult> => {
    try {
      const data =
        await fetchJson(
          `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
            boardSlug
          )}/jobs`
        ) as {
          jobs?: unknown[];
        };

      return {
        valid:
          Array.isArray(
            data.jobs
          ),

        jobCount:
          Array.isArray(
            data.jobs
          )
            ? data.jobs.length
            : 0,
      };
    } catch {
      return {
        valid:
          false,

        jobCount:
          0,
      };
    }
  };

const validateLeverBoard =
  async (
    boardSlug:
      string
  ): Promise<IValidationResult> => {
    try {
      const data =
        await fetchJson(
          `https://api.lever.co/v0/postings/${encodeURIComponent(
            boardSlug
          )}?mode=json`
        );

      return {
        valid:
          Array.isArray(
            data
          ),

        jobCount:
          Array.isArray(
            data
          )
            ? data.length
            : 0,
      };
    } catch {
      return {
        valid:
          false,

        jobCount:
          0,
      };
    }
  };

const validateAshbyBoard =
  async (
    boardSlug:
      string
  ): Promise<IValidationResult> => {
    try {
      const data =
        await fetchJson(
          `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
            boardSlug
          )}`
        ) as {
          jobs?: unknown[];
        };

      return {
        valid:
          Array.isArray(
            data.jobs
          ),

        jobCount:
          Array.isArray(
            data.jobs
          )
            ? data.jobs.length
            : 0,
      };
    } catch {
      return {
        valid:
          false,

        jobCount:
          0,
      };
    }
  };

const validateSuccessFactorsBoard =
  async (
    careersUrl:
      string
  ): Promise<IValidationResult> => {
    try {
      const baseUrl =
        normalizeUrl(
          careersUrl
        );

      /*
       * Most SAP SuccessFactors career sites expose a public
       * search page with startrow pagination.
       */
      const listingUrl =
        `${baseUrl}/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=0`;

      const listingHtml =
        await fetchText(
          listingUrl
        );

      let jobLinks =
        extractSuccessFactorsJobLinks(
          listingHtml,
          baseUrl
        );

      /*
       * Some tenants redirect the search page or show jobs on
       * the homepage. Check the homepage before declaring the
       * company invalid.
       */
      if (
        jobLinks.length ===
        0
      ) {
        const homepageHtml =
          await fetchText(
            baseUrl
          );

        jobLinks =
          extractSuccessFactorsJobLinks(
            homepageHtml,
            baseUrl
          );
      }

      /*
       * A live career site with zero current vacancies is still
       * a valid source. To distinguish it from an unrelated page,
       * look for typical SuccessFactors career-site markers.
       */
      const successFactorsMarker =
        /successfactors|sap|job search|search jobs|careers/i.test(
          listingHtml
        );

      return {
        valid:
          jobLinks.length >
            0 ||
          successFactorsMarker,

        jobCount:
          jobLinks.length,
      };
    } catch {
      return {
        valid:
          false,

        jobCount:
          0,
      };
    }
  };

const validateATSCompany =
  async (
    company:
      ISeedATSCompany
  ): Promise<IValidationResult> => {
    switch (
      company.ats
    ) {
      case "greenhouse":
        return validateGreenhouseBoard(
          company.boardSlug
        );

      case "lever":
        return validateLeverBoard(
          company.boardSlug
        );

      case "ashby":
        return validateAshbyBoard(
          company.boardSlug
        );

      case "successfactors":
        return validateSuccessFactorsBoard(
          company.careersUrl
        );

      default:
        return {
          valid:
            false,

          jobCount:
            0,
        };
    }
  };

/* =========================================================
   DATABASE
========================================================= */

const connectDatabase =
  async (): Promise<void> => {
    if (
      mongoose.connection.readyState ===
      1
    ) {
      return;
    }

    if (
      !env.MONGO_URI
    ) {
      throw new Error(
        "MONGO_URI is missing."
      );
    }

    await mongoose.connect(
      env.MONGO_URI
    );

    console.log(
      "✅ MongoDB connected for ATS company seed."
    );
  };

/* =========================================================
   UPSERT
========================================================= */

const upsertCompany =
  async (
    company:
      ISeedATSCompany,
    jobCount:
      number
  ): Promise<void> => {
    const now =
      new Date();

    await ATSCompany.updateOne(
      {
        ats:
          company.ats,

        boardSlug:
          company.boardSlug,
      },
      {
        $set: {
          companyName:
            company.companyName,

          careersUrl:
            company.careersUrl,

          isActive:
            true,

          priority:
            company.priority,

          jobCount,

          failureCount:
            0,

          lastSuccessfulFetchAt:
            now,

          lastCheckedAt:
            now,
        },

        $setOnInsert: {
          createdAt:
            now,
        },
      },
      {
        upsert:
          true,
      }
    );
  };

/* =========================================================
   SMALL CONCURRENCY POOL
========================================================= */

const runWithConcurrency =
  async <T>(
    items:
      T[],
    worker:
      (
        item: T,
        index: number
      ) => Promise<void>,
    concurrency:
      number
  ): Promise<void> => {
    let cursor =
      0;

    const workers =
      Array.from({
        length:
          Math.min(
            concurrency,
            items.length
          ),
      }).map(
        async () => {
          while (
            true
          ) {
            const index =
              cursor++;

            if (
              index >=
              items.length
            ) {
              return;
            }

            await worker(
              items[index],
              index
            );
          }
        }
      );

    await Promise.all(
      workers
    );
  };

/* =========================================================
   SEED
========================================================= */

const seedATSCompanies =
  async (): Promise<void> => {
    await connectDatabase();

    console.log(
      "========================================================="
    );

    console.log(
      " InterviewIQ ATS Company Registry Seed"
    );

    console.log(
      "========================================================="
    );

    console.log({
      greenhouseCandidates:
        GREENHOUSE_COMPANIES.length,

      leverCandidates:
        LEVER_COMPANIES.length,

      ashbyCandidates:
        ASHBY_COMPANIES.length,

      successFactorsCandidates:
        SUCCESSFACTORS_COMPANIES.length,

      totalCandidates:
        ATS_COMPANIES.length,

      targetMinimumPerProvider:
        MINIMUM_ACTIVE_PER_PROVIDER,
    });

    const seedResults:
      Array<{
        company:
          ISeedATSCompany;

        valid:
          boolean;

        jobCount:
          number;
      }> =
      new Array(
        ATS_COMPANIES.length
      );

    await runWithConcurrency(
      ATS_COMPANIES,
      async (
        company,
        index
      ) => {
        process.stdout.write(
          `Checking ${company.companyName} [${company.ats}]... `
        );

        const validation =
          await validateATSCompany(
            company
          );

        seedResults[index] = {
          company,

          valid:
            validation.valid,

          jobCount:
            validation.jobCount,
        };

        if (
          !validation.valid
        ) {
          console.log(
            "❌ invalid/unavailable — skipped"
          );

          return;
        }

        await upsertCompany(
          company,
          validation.jobCount
        );

        console.log(
          `✅ ${validation.jobCount} jobs`
        );
      },
      VALIDATION_CONCURRENCY
    );

    /* =====================================================
       PROVIDER COUNTS IN THIS RUN
    ===================================================== */

    const validatedCounts:
      Record<
        ATSProvider,
        number
      > = {
        greenhouse:
          0,

        lever:
          0,

        ashby:
          0,

        successfactors:
          0,
      };

    const skippedCounts:
      Record<
        ATSProvider,
        number
      > = {
        greenhouse:
          0,

        lever:
          0,

        ashby:
          0,

        successfactors:
          0,
      };

    for (
      const result of
      seedResults
    ) {
      if (
        !result
      ) {
        continue;
      }

      if (
        result.valid
      ) {
        validatedCounts[
          result.company.ats
        ] +=
          1;
      } else {
        skippedCounts[
          result.company.ats
        ] +=
          1;
      }
    }

    /* =====================================================
       ACTUAL MONGODB COUNTS
    ===================================================== */

    const databaseCounts:
      Record<
        ATSProvider,
        number
      > = {
        greenhouse:
          await ATSCompany.countDocuments({
            ats:
              "greenhouse",

            isActive:
              true,
          }),

        lever:
          await ATSCompany.countDocuments({
            ats:
              "lever",

            isActive:
              true,
          }),

        ashby:
          await ATSCompany.countDocuments({
            ats:
              "ashby",

            isActive:
              true,
          }),

        successfactors:
          await ATSCompany.countDocuments({
            ats:
              "successfactors",

            isActive:
              true,
          }),
      };

    const totalActive =
      databaseCounts.greenhouse +
      databaseCounts.lever +
      databaseCounts.ashby +
      databaseCounts.successfactors;

    console.log(
      ""
    );

    console.log(
      "========================================================="
    );

    console.log(
      " Seed complete"
    );

    console.log(
      "========================================================="
    );

    console.log({
      validatedThisRun:
        validatedCounts,

      skippedThisRun:
        skippedCounts,

      activeInMongoDB:
        databaseCounts,

      totalActive,
    });

    /* =====================================================
       MINIMUM COVERAGE REPORT
    ===================================================== */

    const providers:
      ATSProvider[] = [
        "greenhouse",
        "lever",
        "ashby",
        "successfactors",
      ];

    for (
      const provider of
      providers
    ) {
      const count =
        databaseCounts[
          provider
        ];

      const target =
        provider ===
        "successfactors"
          ? MINIMUM_ACTIVE_SUCCESSFACTORS
          : MINIMUM_ACTIVE_PER_PROVIDER;

      if (
        count >=
        target
      ) {
        console.log(
          `✅ ${provider}: ${count} active companies (target reached)`
        );
      } else {
        console.warn(
          `⚠️ ${provider}: ${count} active companies. Need ${
            target -
            count
          } more to reach the ${target}+ target.`
        );
      }
    }
  };

/* =========================================================
   RUN
========================================================= */

seedATSCompanies()
  .catch(
    (
      error
    ) => {
      console.error(
        "❌ ATS company seed failed:",
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await mongoose.disconnect();
    }
  );
