/* =========================================================
   INTERVIEWIQ CAREER JOB TAXONOMY

   Single source of truth for the 18 career specializations
   supported by InterviewIQ job discovery / skill extraction.

   IMPORTANT:
   This taxonomy is domain-neutral. It intentionally contains:
   - 15 IT / technology specializations
   - Digital Marketing
   - Financial Analysis
   - Logistics & Supply Chain
========================================================= */

export interface ICareerJobTaxonomyItem {
  name:
    string;

  category:
    string;

  titleAliases:
    string[];

  skills:
    string[];
}

export const CAREER_JOB_TAXONOMY:
  ICareerJobTaxonomyItem[] = [
    {
      name:
        "Machine Learning Engineer",

      category:
        "machine-learning",

      titleAliases: [
        "Machine Learning Engineer",
        "ML Engineer",
        "AI Engineer",
        "Applied Machine Learning Engineer",
        "MLOps Engineer",
        "NLP Engineer",
        "LLM Engineer",
      ],

      skills: [
        "Machine Learning",
        "Supervised Learning",
        "Unsupervised Learning",
        "Deep Learning",
        "Neural Networks",
        "NLP",
        "LLM",
        "Prompt Engineering",
        "Embeddings",
        "Vector Databases",
        "Model Evaluation",
        "Feature Engineering",
        "Model Deployment",
        "MLOps",
        "Data Preprocessing",
        "Python",
        "scikit-learn",
        "TensorFlow",
        "PyTorch",
      ],
    },

    {
      name:
        "Data Analyst",

      category:
        "data-analyst",

      titleAliases: [
        "Data Analyst",
        "Business Data Analyst",
        "BI Analyst",
        "Business Intelligence Analyst",
        "Reporting Analyst",
        "Analytics Analyst",
      ],

      skills: [
        "SQL",
        "Excel",
        "Data Cleaning",
        "Data Visualization",
        "Statistical Analysis",
        "Statistics",
        "A/B Testing",
        "Reporting",
        "Dashboards",
        "Business Metrics",
        "Data Interpretation",
        "Power BI",
        "Tableau",
        "Python",
        "pandas",
      ],
    },

    {
      name:
        "Data Engineer",

      category:
        "data-engineer",

      titleAliases: [
        "Data Engineer",
        "ETL Engineer",
        "Analytics Engineer",
        "Big Data Engineer",
        "Data Platform Engineer",
      ],

      skills: [
        "ETL",
        "ELT",
        "Data Pipelines",
        "Data Warehousing",
        "Data Lakes",
        "SQL",
        "Python",
        "Apache Spark",
        "Kafka",
        "Airflow",
        "Distributed Systems",
        "Data Modeling",
        "Data Quality",
        "Big Data",
        "Cloud Data Platforms",
      ],
    },

    {
      name:
        "Data Scientist",

      category:
        "data-scientist",

      titleAliases: [
        "Data Scientist",
        "Applied Data Scientist",
        "Research Data Scientist",
        "Decision Scientist",
      ],

      skills: [
        "Predictive Modeling",
        "Feature Engineering",
        "Statistics",
        "Probability",
        "Machine Learning",
        "Python",
        "pandas",
        "scikit-learn",
        "Experiment Design",
        "Model Evaluation",
        "Data Visualization",
        "Data Storytelling",
        "Regression",
        "Classification",
      ],
    },

    {
      name:
        "Database Engineer",

      category:
        "database-engineer",

      titleAliases: [
        "Database Engineer",
        "Database Administrator",
        "DBA",
        "Database Developer",
        "SQL Database Engineer",
        "Oracle Database Administrator",
      ],

      skills: [
        "SQL",
        "MySQL",
        "PostgreSQL",
        "Oracle",
        "MongoDB",
        "Mongoose",
        "RDBMS",
        "NoSQL",
        "Data Modeling",
        "Indexing",
        "Query Optimization",
        "Transactions",
        "Replication",
        "Sharding",
        "Backup",
        "High Availability",
        "Database Security",
        "Performance Tuning",
      ],
    },

    {
      name:
        "UI/UX Designer",

      category:
        "ui-ux",

      titleAliases: [
        "UI/UX Designer",
        "UX Designer",
        "UI Designer",
        "Product Designer",
        "Interaction Designer",
        "UX Researcher",
      ],

      skills: [
        "Figma",
        "Wireframing",
        "Prototyping",
        "User Research",
        "Usability Testing",
        "Accessibility",
        "Design Systems",
        "Interaction Design",
        "Information Architecture",
        "Responsive Design",
        "User Flows",
        "Visual Hierarchy",
      ],
    },

    {
      name:
        "Cloud Engineer",

      category:
        "cloud",

      titleAliases: [
        "Cloud Engineer",
        "Cloud Infrastructure Engineer",
        "Cloud Platform Engineer",
        "Cloud Architect",
        "AWS Engineer",
        "Azure Engineer",
        "GCP Engineer",
      ],

      skills: [
        "Cloud Architecture",
        "AWS",
        "Azure",
        "GCP",
        "IAM",
        "Networking",
        "Serverless",
        "Containers",
        "Kubernetes",
        "Infrastructure as Code",
        "Terraform",
        "Cloud Security",
        "Monitoring",
        "High Availability",
        "Disaster Recovery",
        "Cost Optimization",
      ],
    },

    {
      name:
        "DevOps Engineer",

      category:
        "devops",

      titleAliases: [
        "DevOps Engineer",
        "Platform Engineer",
        "Site Reliability Engineer",
        "SRE",
        "Build Engineer",
        "Release Engineer",
      ],

      skills: [
        "CI/CD",
        "Docker",
        "Kubernetes",
        "Linux",
        "Git",
        "GitHub Actions",
        "Jenkins",
        "Terraform",
        "Monitoring",
        "Logging",
        "Infrastructure as Code",
        "Cloud",
        "Networking",
        "Security",
        "Automation",
        "Incident Response",
      ],
    },

    {
      name:
        "QA Engineer",

      category:
        "qa",

      titleAliases: [
        "QA Engineer",
        "Quality Assurance Engineer",
        "Software Test Engineer",
        "Test Automation Engineer",
        "Automation QA Engineer",
        "Manual QA Engineer",
      ],

      skills: [
        "Manual Testing",
        "Automation Testing",
        "Test Cases",
        "Test Plans",
        "Regression Testing",
        "API Testing",
        "Postman",
        "Selenium",
        "Playwright",
        "Cypress",
        "Bug Reporting",
        "SQL",
        "Performance Testing",
        "CI/CD Testing",
        "Test Strategy",
      ],
    },

    {
      name:
        "Cybersecurity Engineer",

      category:
        "cybersecurity",

      titleAliases: [
        "Cybersecurity Engineer",
        "Security Engineer",
        "Cyber Security Engineer",
        "SOC Analyst",
        "Security Analyst",
        "Application Security Engineer",
        "Cloud Security Engineer",
      ],

      skills: [
        "Network Security",
        "Application Security",
        "OWASP",
        "Authentication",
        "Authorization",
        "Cryptography",
        "IAM",
        "Threat Modeling",
        "Penetration Testing",
        "SIEM",
        "Incident Response",
        "Malware",
        "Cloud Security",
        "Zero Trust",
        "Vulnerability Management",
      ],
    },

    {
      name:
        "Backend Developer",

      category:
        "backend",

      titleAliases: [
        "Backend Developer",
        "Backend Engineer",
        "Back End Developer",
        "Server Side Developer",
        "API Developer",
        "Node.js Developer",
      ],

      skills: [
        "Node.js",
        "Express",
        "Java",
        "Python",
        "Go",
        "PHP",
        "REST API",
        "GraphQL",
        "Authentication",
        "Authorization",
        "SQL",
        "PostgreSQL",
        "MySQL",
        "MongoDB",
        "Redis",
        "Caching",
        "Testing",
        "Security",
        "Microservices",
        "System Design",
        "Scalability",
        "Performance",
        "Message Queues",
        "Concurrency",
        "Docker",
      ],
    },

    {
      name:
        "Frontend Developer",

      category:
        "frontend",

      titleAliases: [
        "Frontend Developer",
        "Frontend Engineer",
        "Front End Developer",
        "UI Engineer",
        "React Developer",
        "JavaScript Developer",
      ],

      skills: [
        "HTML",
        "CSS",
        "SASS",
        "SCSS",
        "JavaScript",
        "TypeScript",
        "React",
        "Next.js",
        "Redux",
        "State Management",
        "DOM",
        "Browser APIs",
        "Accessibility",
        "Web Performance",
        "Testing",
        "Web Security",
        "Responsive Design",
        "Networking",
        "Web Vitals",
        "Tailwind CSS",
        "Bootstrap",
        "Vue",
        "Angular",
      ],
    },

    {
      name:
        "Full Stack Developer",

      category:
        "fullstack",

      titleAliases: [
        "Full Stack Developer",
        "Full-Stack Developer",
        "Full Stack Engineer",
        "Full-Stack Engineer",
        "Web Developer",
        "MERN Developer",
      ],

      skills: [
        "HTML",
        "CSS",
        "JavaScript",
        "TypeScript",
        "React",
        "Node.js",
        "Express",
        "REST API",
        "GraphQL",
        "SQL",
        "PostgreSQL",
        "MongoDB",
        "Authentication",
        "Authorization",
        "Deployment",
        "Testing",
        "System Design",
        "Caching",
        "Security",
        "CI/CD",
        "Docker",
        "Cloud",
        "Performance",
      ],
    },

    {
      name:
        "Mobile Developer",

      category:
        "mobile",

      titleAliases: [
        "Mobile Developer",
        "Mobile Engineer",
        "Android Developer",
        "iOS Developer",
        "React Native Developer",
        "Flutter Developer",
      ],

      skills: [
        "Android",
        "iOS",
        "React Native",
        "Flutter",
        "Swift",
        "Kotlin",
        "Mobile UI",
        "Navigation",
        "State Management",
        "Mobile APIs",
        "Offline Storage",
        "Mobile Performance",
        "Push Notifications",
        "Mobile Security",
        "App Lifecycle",
        "Mobile Testing",
        "App Store Deployment",
      ],
    },

    {
      name:
        "Software Engineer",

      category:
        "software-engineering",

      titleAliases: [
        "Software Engineer",
        "Software Developer",
        "Application Engineer",
        "Application Developer",
        "Systems Engineer",
      ],

      skills: [
        "Programming Fundamentals",
        "Algorithms",
        "Data Structures",
        "OOP",
        "Design Patterns",
        "Testing",
        "Debugging",
        "System Design",
        "Software Architecture",
        "Concurrency",
        "Performance",
        "Databases",
        "Networking",
        "Git",
        "Clean Code",
        "Software Engineering",
        "JavaScript",
        "TypeScript",
        "Python",
        "Java",
        "C++",
        "C#",
        "Go",
        "Rust",
      ],
    },

    {
      name:
        "Digital Marketing Specialist",

      category:
        "digital-marketing",

      titleAliases: [
        "Digital Marketing Specialist",
        "Digital Marketing Manager",
        "Marketing Specialist",
        "Performance Marketing Specialist",
        "Growth Marketing Specialist",
        "SEO Specialist",
        "SEM Specialist",
        "Paid Media Specialist",
        "PPC Specialist",
        "Marketing Analyst",
      ],

      skills: [
        "SEO",
        "SEM",
        "Google Ads",
        "Meta Ads",
        "Google Analytics",
        "Web Analytics",
        "Conversion Rate Optimization",
        "Content Strategy",
        "Email Marketing",
        "Social Media Marketing",
        "Attribution",
        "Customer Acquisition",
        "Campaign Optimization",
        "Marketing Funnels",
        "A/B Testing",
        "ROI",
        "ROAS",
        "CPA",
        "CPC",
        "CTR",
        "PPC",
        "Lead Generation",
        "CRM",
      ],
    },

    {
      name:
        "Financial Analyst",

      category:
        "financial-analysis",

      titleAliases: [
        "Financial Analyst",
        "Finance Analyst",
        "FP&A Analyst",
        "FP&A Specialist",
        "Corporate Finance Analyst",
        "Investment Analyst",
        "Budget Analyst",
        "Financial Planning Analyst",
      ],

      skills: [
        "Financial Statements",
        "Financial Modeling",
        "Forecasting",
        "Budgeting",
        "Valuation",
        "Cash Flow",
        "Ratio Analysis",
        "Excel",
        "Risk Analysis",
        "Variance Analysis",
        "Corporate Finance",
        "NPV",
        "IRR",
        "DCF",
        "WACC",
        "Profitability",
        "Working Capital",
        "Scenario Analysis",
        "Financial Planning",
        "FP&A",
      ],
    },

    {
      name:
        "Logistics & Supply Chain Specialist",

      category:
        "logistics-supply-chain",

      titleAliases: [
        "Logistics Specialist",
        "Logistics Coordinator",
        "Supply Chain Specialist",
        "Supply Chain Analyst",
        "Supply Chain Coordinator",
        "Procurement Specialist",
        "Inventory Specialist",
        "Warehouse Specialist",
        "Transportation Specialist",
        "Demand Planner",
        "Supply Planner",
        "SAP Logistics Specialist",
      ],

      skills: [
        "Inventory Management",
        "Procurement",
        "Transportation",
        "Warehousing",
        "Demand Forecasting",
        "Supply Planning",
        "Supplier Management",
        "Incoterms",
        "Lead Time",
        "Logistics KPIs",
        "Supply Chain Optimization",
        "Order Fulfillment",
        "Distribution",
        "Inventory Turnover",
        "Risk Management",
        "ERP",
        "SAP",
        "SAP MM",
        "SAP SD",
        "SAP PM",
        "Route Planning",
        "EOQ",
        "Freight",
      ],
    },
  ];

/* =========================================================
   FLATTENED EXPORTS
========================================================= */

const uniqueCaseInsensitive =
  (
    values:
      string[]
  ): string[] => {
    const seen =
      new Set<string>();

    const result:
      string[] =
      [];

    for (
      const value
      of values
    ) {
      const cleaned =
        value.trim();

      if (
        !cleaned
      ) {
        continue;
      }

      const key =
        cleaned.toLowerCase();

      if (
        seen.has(
          key
        )
      ) {
        continue;
      }

      seen.add(
        key
      );

      result.push(
        cleaned
      );
    }

    return result;
  };

export const ALL_CAREER_SKILLS =
  uniqueCaseInsensitive(
    CAREER_JOB_TAXONOMY.flatMap(
      (
        item
      ) =>
        item.skills
    )
  );

export const ALL_CAREER_ROLE_TITLES =
  uniqueCaseInsensitive(
    CAREER_JOB_TAXONOMY.flatMap(
      (
        item
      ) => [
        item.name,
        ...item.titleAliases,
      ]
    )
  );

export const getCareerJobTaxonomyByCategory =
  (
    category:
      string
  ): ICareerJobTaxonomyItem | null => {
    const normalized =
      category
        .trim()
        .toLowerCase();

    return (
      CAREER_JOB_TAXONOMY.find(
        (
          item
        ) =>
          item.category ===
          normalized
      ) ||
      null
    );
  };

export default {
  CAREER_JOB_TAXONOMY,
  ALL_CAREER_SKILLS,
  ALL_CAREER_ROLE_TITLES,
  getCareerJobTaxonomyByCategory,
};
