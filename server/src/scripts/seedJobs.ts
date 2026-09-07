import dns from "node:dns";

import mongoose from "mongoose";

import { env } from "../config/env";

import {
  Job,
  type IJob,
  type JobExperienceLevel,
} from "../models/Job";

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

type JobSeedItem =
  Omit<
    IJob,
    | "experienceMin"
    | "experienceMax"
  >;

const getExperienceRange = (
  experienceLevel: JobExperienceLevel
): {
  experienceMin: number;
  experienceMax: number | null;
} => {
  switch (
    experienceLevel
  ) {
    case "entry":
      return {
        experienceMin: 0,
        experienceMax: 1,
      };

    case "junior":
      return {
        experienceMin: 0,
        experienceMax: 2,
      };

    case "mid":
      return {
        experienceMin: 2,
        experienceMax: 5,
      };

    case "senior":
      return {
        experienceMin: 5,
        experienceMax: null,
      };
  }
};

const jobs: JobSeedItem[] = [
  {
    title:
      "Frontend Developer Intern",

    company:
      "LaunchStack",

    location:
      "Cambridge, MA",

    remoteType:
      "hybrid",

    employmentType:
      "internship",

    experienceLevel:
      "entry",

    description:
      "LaunchStack is looking for a frontend intern interested in building modern web applications and learning professional development workflows.",

    responsibilities: [
      "Build responsive user interfaces using modern frontend technologies.",
      "Work with developers to implement reusable UI components.",
      "Fix frontend bugs and improve application usability.",
      "Participate in code reviews and team development workflows.",
    ],

    requirements: [
      "Basic understanding of JavaScript.",
      "Knowledge of HTML and CSS.",
      "Experience building projects with React.",
      "Basic understanding of Git.",
    ],

    preferredQualifications: [
      "Personal frontend projects.",
      "Familiarity with REST APIs.",
      "Understanding of responsive web design.",
    ],

    skills: [
      "JavaScript",
      "HTML",
      "CSS",
      "React",
      "Git",
    ],

    keywords: [
      "frontend",
      "javascript",
      "react",
      "html",
      "css",
      "git",
    ],

    education: [
      "Computer Science",
      "Information Technology",
      "Software Engineering",
    ],

    salary: 3200,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Junior Frontend Developer",

    company:
      "TechNova",

    location:
      "Boston, MA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "TechNova is seeking a Junior Frontend Developer to build responsive and accessible web applications for modern digital products.",

    responsibilities: [
      "Develop reusable React components.",
      "Implement responsive user interfaces.",
      "Integrate frontend applications with REST APIs.",
      "Collaborate with product and design teams.",
    ],

    requirements: [
      "Experience with React.",
      "Strong JavaScript fundamentals.",
      "Knowledge of HTML and CSS.",
      "Experience using Git.",
      "Basic REST API knowledge.",
    ],

    preferredQualifications: [
      "TypeScript experience.",
      "Testing experience.",
      "Understanding of accessibility standards.",
    ],

    skills: [
      "React",
      "JavaScript",
      "HTML",
      "CSS",
      "Git",
      "REST API",
    ],

    keywords: [
      "frontend",
      "react",
      "javascript",
      "rest api",
      "web development",
    ],

    education: [
      "Computer Science",
      "Information Technology",
      "Software Engineering",
    ],

    salary: 5200,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Frontend Developer",

    company:
      "BrightLabs",

    location:
      "New York, NY",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "BrightLabs is hiring a Frontend Developer to create scalable interfaces for customer-facing applications.",

    responsibilities: [
      "Develop React-based web applications.",
      "Build reusable UI components.",
      "Integrate frontend applications with backend services.",
      "Improve performance and accessibility.",
    ],

    requirements: [
      "React development experience.",
      "Strong JavaScript skills.",
      "Knowledge of HTML and CSS.",
      "REST API integration experience.",
    ],

    preferredQualifications: [
      "TypeScript knowledge.",
      "Experience with automated testing.",
    ],

    skills: [
      "React",
      "JavaScript",
      "HTML",
      "CSS",
      "TypeScript",
      "REST API",
    ],

    keywords: [
      "frontend",
      "react",
      "typescript",
      "javascript",
      "api",
    ],

    education: [
      "Computer Science",
      "Information Technology",
    ],

    salary: 6500,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "React Developer",

    company:
      "PixelWorks",

    location:
      "Austin, TX",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "PixelWorks is looking for a React Developer to build interactive web experiences and scalable frontend architecture.",

    responsibilities: [
      "Develop production React applications.",
      "Create reusable application architecture.",
      "Integrate APIs and application state.",
      "Improve frontend performance.",
    ],

    requirements: [
      "Strong React experience.",
      "JavaScript and TypeScript knowledge.",
      "State management experience.",
      "REST API integration experience.",
    ],

    preferredQualifications: [
      "Redux experience.",
      "Next.js familiarity.",
      "Frontend testing experience.",
    ],

    skills: [
      "React",
      "JavaScript",
      "TypeScript",
      "Redux",
      "REST API",
    ],

    keywords: [
      "react",
      "frontend",
      "redux",
      "typescript",
      "javascript",
    ],

    education: [
      "Computer Science",
      "Software Engineering",
    ],

    salary: 7800,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Frontend Engineer",

    company:
      "CloudSphere",

    location:
      "Seattle, WA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "CloudSphere is hiring a Frontend Engineer to design high-performance user interfaces for cloud management products.",

    responsibilities: [
      "Design frontend architecture.",
      "Build scalable React components.",
      "Integrate GraphQL services.",
      "Write frontend tests.",
    ],

    requirements: [
      "Strong React experience.",
      "TypeScript development experience.",
      "Knowledge of GraphQL.",
      "Testing experience.",
    ],

    preferredQualifications: [
      "Cloud platform experience.",
      "Jest testing knowledge.",
    ],

    skills: [
      "React",
      "TypeScript",
      "JavaScript",
      "GraphQL",
      "Jest",
      "Git",
    ],

    keywords: [
      "frontend",
      "react",
      "typescript",
      "graphql",
      "jest",
    ],

    education: [
      "Computer Science",
      "Software Engineering",
    ],

    salary: 8200,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Full Stack Software Engineer",

    company:
      "VectorLabs",

    location:
      "Austin, TX",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "VectorLabs is looking for a Full Stack Software Engineer to develop customer-facing applications and backend services.",

    responsibilities: [
      "Build frontend applications with React.",
      "Develop Node.js backend services.",
      "Design database schemas.",
      "Deploy containerized applications.",
    ],

    requirements: [
      "React experience.",
      "Node.js backend knowledge.",
      "TypeScript experience.",
      "PostgreSQL knowledge.",
      "Docker experience.",
    ],

    preferredQualifications: [
      "Cloud deployment experience.",
      "CI/CD knowledge.",
    ],

    skills: [
      "React",
      "Node.js",
      "TypeScript",
      "PostgreSQL",
      "Docker",
      "Git",
    ],

    keywords: [
      "full stack",
      "react",
      "node.js",
      "typescript",
      "postgresql",
      "docker",
    ],

    education: [
      "Computer Science",
      "Software Engineering",
      "Information Technology",
    ],

    salary: 8500,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Junior Full Stack Developer",

    company:
      "DevBridge",

    location:
      "Chicago, IL",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "DevBridge is hiring a Junior Full Stack Developer to work across frontend applications and backend APIs.",

    responsibilities: [
      "Develop React user interfaces.",
      "Build Node.js APIs.",
      "Work with MongoDB databases.",
      "Fix bugs across the application stack.",
    ],

    requirements: [
      "JavaScript knowledge.",
      "React fundamentals.",
      "Node.js fundamentals.",
      "MongoDB knowledge.",
    ],

    preferredQualifications: [
      "TypeScript familiarity.",
      "Express experience.",
    ],

    skills: [
      "JavaScript",
      "React",
      "Node.js",
      "Express",
      "MongoDB",
      "Git",
    ],

    keywords: [
      "full stack",
      "javascript",
      "react",
      "node.js",
      "mongodb",
    ],

    education: [
      "Computer Science",
      "Information Technology",
    ],

    salary: 5800,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Backend Developer",

    company:
      "CoreSystems",

    location:
      "Boston, MA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "CoreSystems is seeking a Backend Developer to build reliable APIs and scalable server-side applications.",

    responsibilities: [
      "Develop REST APIs.",
      "Design backend services.",
      "Work with relational databases.",
      "Improve application security.",
    ],

    requirements: [
      "Node.js experience.",
      "Express experience.",
      "PostgreSQL knowledge.",
      "REST API knowledge.",
    ],

    preferredQualifications: [
      "Docker experience.",
      "AWS knowledge.",
    ],

    skills: [
      "Node.js",
      "Express",
      "PostgreSQL",
      "REST API",
      "Docker",
    ],

    keywords: [
      "backend",
      "node.js",
      "express",
      "postgresql",
      "api",
    ],

    education: [
      "Computer Science",
      "Software Engineering",
    ],

    salary: 7900,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Junior Backend Developer",

    company:
      "ServerCraft",

    location:
      "Denver, CO",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "ServerCraft is looking for a Junior Backend Developer to develop APIs and database-driven services.",

    responsibilities: [
      "Build REST APIs.",
      "Maintain Node.js applications.",
      "Work with MongoDB.",
      "Write backend tests.",
    ],

    requirements: [
      "JavaScript knowledge.",
      "Node.js fundamentals.",
      "Express fundamentals.",
      "Database knowledge.",
    ],

    preferredQualifications: [
      "MongoDB experience.",
      "TypeScript familiarity.",
    ],

    skills: [
      "JavaScript",
      "Node.js",
      "Express",
      "MongoDB",
      "REST API",
    ],

    keywords: [
      "backend",
      "node.js",
      "javascript",
      "mongodb",
      "rest api",
    ],

    education: [
      "Computer Science",
      "Information Technology",
    ],

    salary: 5400,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Node.js Developer",

    company:
      "APIForge",

    location:
      "San Francisco, CA",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "APIForge is hiring a Node.js Developer to create scalable API services and backend infrastructure.",

    responsibilities: [
      "Develop Node.js microservices.",
      "Design REST APIs.",
      "Optimize database queries.",
      "Maintain backend infrastructure.",
    ],

    requirements: [
      "Strong Node.js experience.",
      "Express experience.",
      "Database design knowledge.",
      "REST API experience.",
    ],

    preferredQualifications: [
      "Redis knowledge.",
      "Docker experience.",
    ],

    skills: [
      "Node.js",
      "Express",
      "REST API",
      "PostgreSQL",
      "Redis",
      "Docker",
    ],

    keywords: [
      "node.js",
      "backend",
      "api",
      "redis",
      "docker",
    ],

    education: [
      "Computer Science",
      "Software Engineering",
    ],

    salary: 8300,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Software Engineer",

    company:
      "NexaTech",

    location:
      "New York, NY",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "NexaTech is looking for a Software Engineer to build scalable web applications and platform services.",

    responsibilities: [
      "Develop application features.",
      "Design scalable services.",
      "Review code.",
      "Improve system reliability.",
    ],

    requirements: [
      "Strong programming fundamentals.",
      "JavaScript or TypeScript experience.",
      "REST API knowledge.",
      "Git experience.",
    ],

    preferredQualifications: [
      "Cloud experience.",
      "Docker familiarity.",
    ],

    skills: [
      "JavaScript",
      "TypeScript",
      "Git",
      "REST API",
      "Docker",
    ],

    keywords: [
      "software engineer",
      "javascript",
      "typescript",
      "api",
      "git",
    ],

    education: [
      "Computer Science",
      "Software Engineering",
      "Information Technology",
    ],

    salary: 8600,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Junior Software Engineer",

    company:
      "CodeAxis",

    location:
      "Boston, MA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "CodeAxis is hiring a Junior Software Engineer to contribute to web applications and internal software platforms.",

    responsibilities: [
      "Develop application features.",
      "Fix software bugs.",
      "Write maintainable code.",
      "Participate in code reviews.",
    ],

    requirements: [
      "Programming fundamentals.",
      "JavaScript knowledge.",
      "Git experience.",
      "Basic knowledge of APIs.",
    ],

    preferredQualifications: [
      "React familiarity.",
      "Node.js familiarity.",
    ],

    skills: [
      "JavaScript",
      "Git",
      "REST API",
      "React",
      "Node.js",
    ],

    keywords: [
      "software engineer",
      "javascript",
      "git",
      "api",
    ],

    education: [
      "Computer Science",
      "Information Technology",
      "Software Engineering",
    ],

    salary: 5700,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Web Developer",

    company:
      "WebNest",

    location:
      "Miami, FL",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "WebNest is seeking a Web Developer to create responsive websites and interactive digital experiences.",

    responsibilities: [
      "Build responsive websites.",
      "Implement frontend functionality.",
      "Optimize website performance.",
      "Maintain existing websites.",
    ],

    requirements: [
      "HTML knowledge.",
      "CSS knowledge.",
      "JavaScript knowledge.",
      "Git fundamentals.",
    ],

    preferredQualifications: [
      "React experience.",
      "CMS familiarity.",
    ],

    skills: [
      "HTML",
      "CSS",
      "JavaScript",
      "Git",
      "React",
    ],

    keywords: [
      "web development",
      "html",
      "css",
      "javascript",
      "frontend",
    ],

    education: [
      "Information Technology",
      "Computer Science",
      "Web Development",
    ],

    salary: 4900,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "UI Developer",

    company:
      "DesignGrid",

    location:
      "Los Angeles, CA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "DesignGrid is looking for a UI Developer to turn modern product designs into responsive frontend interfaces.",

    responsibilities: [
      "Implement responsive interfaces.",
      "Collaborate with designers.",
      "Build reusable UI components.",
      "Maintain design consistency.",
    ],

    requirements: [
      "HTML and CSS expertise.",
      "JavaScript experience.",
      "React experience.",
      "Responsive design knowledge.",
    ],

    preferredQualifications: [
      "Figma experience.",
      "Design system knowledge.",
    ],

    skills: [
      "HTML",
      "CSS",
      "JavaScript",
      "React",
      "Figma",
      "UI Design",
    ],

    keywords: [
      "ui",
      "frontend",
      "react",
      "figma",
      "design systems",
    ],

    education: [
      "Design",
      "Computer Science",
      "Information Technology",
    ],

    salary: 6800,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "UX Engineer",

    company:
      "HumanPixel",

    location:
      "Portland, OR",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "HumanPixel is hiring a UX Engineer to bridge product design and frontend engineering.",

    responsibilities: [
      "Prototype user experiences.",
      "Build interactive components.",
      "Collaborate with UX researchers.",
      "Improve usability.",
    ],

    requirements: [
      "Frontend development experience.",
      "UX knowledge.",
      "React familiarity.",
      "Figma experience.",
    ],

    preferredQualifications: [
      "User research experience.",
      "Accessibility knowledge.",
    ],

    skills: [
      "React",
      "JavaScript",
      "Figma",
      "UX Design",
      "Prototyping",
    ],

    keywords: [
      "ux",
      "user research",
      "frontend",
      "figma",
      "prototyping",
    ],

    education: [
      "Design",
      "Human Computer Interaction",
      "Computer Science",
    ],

    salary: 7200,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Product Designer",

    company:
      "FlowStudio",

    location:
      "New York, NY",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "FlowStudio is hiring a Product Designer to create user-centered digital products and design systems.",

    responsibilities: [
      "Design product experiences.",
      "Create wireframes and prototypes.",
      "Conduct user research.",
      "Maintain design systems.",
    ],

    requirements: [
      "Figma experience.",
      "Product design experience.",
      "Wireframing knowledge.",
      "Prototyping experience.",
    ],

    preferredQualifications: [
      "Frontend knowledge.",
      "User research experience.",
    ],

    skills: [
      "Figma",
      "Product Design",
      "Wireframing",
      "Prototyping",
      "User Research",
    ],

    keywords: [
      "product design",
      "figma",
      "ux",
      "wireframing",
      "user research",
    ],

    education: [
      "Design",
      "Human Computer Interaction",
    ],

    salary: 7500,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "QA Engineer",

    company:
      "QualityWorks",

    location:
      "Boston, MA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "QualityWorks is seeking a QA Engineer to test web applications and improve product reliability.",

    responsibilities: [
      "Create test cases.",
      "Perform manual testing.",
      "Report defects.",
      "Collaborate with developers.",
    ],

    requirements: [
      "Software testing fundamentals.",
      "Bug reporting experience.",
      "Understanding of web applications.",
      "Basic API testing knowledge.",
    ],

    preferredQualifications: [
      "Automation testing experience.",
      "JavaScript familiarity.",
    ],

    skills: [
      "Manual Testing",
      "API Testing",
      "JavaScript",
      "Git",
    ],

    keywords: [
      "qa",
      "testing",
      "api testing",
      "quality assurance",
    ],

    education: [
      "Computer Science",
      "Information Technology",
    ],

    salary: 5200,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "QA Automation Engineer",

    company:
      "TestCore",

    location:
      "Chicago, IL",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "TestCore is looking for a QA Automation Engineer to build automated testing frameworks for web applications.",

    responsibilities: [
      "Develop automated tests.",
      "Maintain testing frameworks.",
      "Integrate tests into CI/CD.",
      "Investigate software defects.",
    ],

    requirements: [
      "Automation testing experience.",
      "JavaScript or TypeScript knowledge.",
      "API testing experience.",
      "Git knowledge.",
    ],

    preferredQualifications: [
      "Playwright experience.",
      "Cypress experience.",
    ],

    skills: [
      "JavaScript",
      "TypeScript",
      "API Testing",
      "Git",
      "CI/CD",
    ],

    keywords: [
      "qa",
      "automation",
      "testing",
      "javascript",
      "ci/cd",
    ],

    education: [
      "Computer Science",
      "Information Technology",
    ],

    salary: 7300,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "DevOps Engineer",

    company:
      "InfraCloud",

    location:
      "Seattle, WA",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "InfraCloud is hiring a DevOps Engineer to manage cloud infrastructure and automated deployment systems.",

    responsibilities: [
      "Maintain CI/CD pipelines.",
      "Manage cloud infrastructure.",
      "Deploy containerized services.",
      "Monitor production systems.",
    ],

    requirements: [
      "Docker experience.",
      "CI/CD experience.",
      "Cloud platform knowledge.",
      "Linux knowledge.",
    ],

    preferredQualifications: [
      "Kubernetes knowledge.",
      "Terraform experience.",
    ],

    skills: [
      "Docker",
      "CI/CD",
      "AWS",
      "Linux",
      "Kubernetes",
      "Terraform",
    ],

    keywords: [
      "devops",
      "docker",
      "aws",
      "kubernetes",
      "terraform",
    ],

    education: [
      "Computer Science",
      "Information Technology",
    ],

    salary: 9000,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Cloud Engineer",

    company:
      "SkyCompute",

    location:
      "Austin, TX",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "SkyCompute is looking for a Cloud Engineer to develop and maintain scalable cloud infrastructure.",

    responsibilities: [
      "Manage AWS infrastructure.",
      "Automate deployments.",
      "Monitor cloud resources.",
      "Improve system reliability.",
    ],

    requirements: [
      "AWS experience.",
      "Linux knowledge.",
      "Docker knowledge.",
      "Infrastructure automation experience.",
    ],

    preferredQualifications: [
      "Terraform knowledge.",
      "Kubernetes knowledge.",
    ],

    skills: [
      "AWS",
      "Linux",
      "Docker",
      "Terraform",
      "Kubernetes",
    ],

    keywords: [
      "cloud",
      "aws",
      "docker",
      "terraform",
      "linux",
    ],

    education: [
      "Computer Science",
      "Information Technology",
    ],

    salary: 8800,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Data Analyst",

    company:
      "DataPoint",

    location:
      "Boston, MA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "DataPoint is looking for a Data Analyst to analyze business data and create actionable insights.",

    responsibilities: [
      "Analyze datasets.",
      "Create reports.",
      "Build dashboards.",
      "Present analytical findings.",
    ],

    requirements: [
      "SQL knowledge.",
      "Data analysis fundamentals.",
      "Spreadsheet experience.",
      "Basic statistics knowledge.",
    ],

    preferredQualifications: [
      "Python knowledge.",
      "Data visualization experience.",
    ],

    skills: [
      "SQL",
      "Python",
      "Data Analysis",
      "Statistics",
    ],

    keywords: [
      "data analyst",
      "sql",
      "python",
      "analytics",
      "statistics",
    ],

    education: [
      "Data Science",
      "Statistics",
      "Computer Science",
      "Mathematics",
    ],

    salary: 5700,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Junior Data Scientist",

    company:
      "InsightAI",

    location:
      "New York, NY",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "InsightAI is hiring a Junior Data Scientist to build predictive models and analyze business datasets.",

    responsibilities: [
      "Analyze datasets.",
      "Build machine learning models.",
      "Prepare data.",
      "Evaluate model performance.",
    ],

    requirements: [
      "Python knowledge.",
      "Pandas experience.",
      "NumPy experience.",
      "Machine learning fundamentals.",
    ],

    preferredQualifications: [
      "Scikit-learn experience.",
      "Statistics knowledge.",
    ],

    skills: [
      "Python",
      "Pandas",
      "NumPy",
      "Machine Learning",
      "Scikit-learn",
    ],

    keywords: [
      "data science",
      "python",
      "machine learning",
      "pandas",
      "statistics",
    ],

    education: [
      "Data Science",
      "Computer Science",
      "Statistics",
      "Mathematics",
    ],

    salary: 6500,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Junior Machine Learning Engineer",

    company:
      "ModelForge",

    location:
      "San Francisco, CA",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "ModelForge is looking for a Junior Machine Learning Engineer to help build and deploy machine learning systems.",

    responsibilities: [
      "Train machine learning models.",
      "Prepare datasets.",
      "Evaluate models.",
      "Support model deployment.",
    ],

    requirements: [
      "Python knowledge.",
      "Machine learning fundamentals.",
      "NumPy familiarity.",
      "Pandas familiarity.",
    ],

    preferredQualifications: [
      "PyTorch experience.",
      "MLOps knowledge.",
    ],

    skills: [
      "Python",
      "Machine Learning",
      "NumPy",
      "Pandas",
      "PyTorch",
    ],

    keywords: [
      "ml",
      "python",
      "machine learning",
      "pytorch",
      "mlops",
    ],

    education: [
      "Computer Science",
      "Data Science",
      "Mathematics",
    ],

    salary: 7200,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Machine Learning Engineer",

    company:
      "NeuralStack",

    location:
      "San Francisco, CA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "NeuralStack is seeking a Machine Learning Engineer to develop scalable AI and machine learning systems.",

    responsibilities: [
      "Train machine learning models.",
      "Build model pipelines.",
      "Deploy models.",
      "Monitor model performance.",
    ],

    requirements: [
      "Strong Python experience.",
      "Machine learning experience.",
      "PyTorch or TensorFlow experience.",
      "Data processing knowledge.",
    ],

    preferredQualifications: [
      "MLOps knowledge.",
      "Cloud experience.",
    ],

    skills: [
      "Python",
      "Machine Learning",
      "PyTorch",
      "TensorFlow",
      "MLOps",
      "Docker",
    ],

    keywords: [
      "machine learning",
      "python",
      "pytorch",
      "tensorflow",
      "mlops",
    ],

    education: [
      "Computer Science",
      "Data Science",
      "Mathematics",
    ],

    salary: 9800,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "AI Engineer",

    company:
      "CognitiveLabs",

    location:
      "New York, NY",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "CognitiveLabs is hiring an AI Engineer to develop intelligent systems powered by modern machine learning technologies.",

    responsibilities: [
      "Develop AI applications.",
      "Integrate machine learning models.",
      "Build inference services.",
      "Evaluate AI systems.",
    ],

    requirements: [
      "Python experience.",
      "Machine learning knowledge.",
      "API development experience.",
      "Model integration experience.",
    ],

    preferredQualifications: [
      "NLP experience.",
      "Transformer model experience.",
    ],

    skills: [
      "Python",
      "Artificial Intelligence",
      "Machine Learning",
      "REST API",
      "NLP",
      "Transformers",
    ],

    keywords: [
      "ai",
      "machine learning",
      "python",
      "nlp",
      "transformers",
    ],

    education: [
      "Computer Science",
      "Artificial Intelligence",
      "Data Science",
    ],

    salary: 10200,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Data Engineer",

    company:
      "PipelineWorks",

    location:
      "Seattle, WA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "PipelineWorks is looking for a Data Engineer to develop scalable data pipelines and analytics infrastructure.",

    responsibilities: [
      "Build data pipelines.",
      "Maintain databases.",
      "Process large datasets.",
      "Improve data reliability.",
    ],

    requirements: [
      "Python knowledge.",
      "SQL expertise.",
      "Database experience.",
      "ETL knowledge.",
    ],

    preferredQualifications: [
      "AWS knowledge.",
      "Docker experience.",
    ],

    skills: [
      "Python",
      "SQL",
      "PostgreSQL",
      "AWS",
      "Docker",
    ],

    keywords: [
      "data engineer",
      "python",
      "sql",
      "aws",
      "etl",
    ],

    education: [
      "Computer Science",
      "Data Science",
      "Information Technology",
    ],

    salary: 8700,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Database Developer",

    company:
      "QueryBase",

    location:
      "Dallas, TX",

    remoteType:
      "onsite",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "QueryBase is seeking a Database Developer to design efficient database systems and optimize data operations.",

    responsibilities: [
      "Design database schemas.",
      "Write SQL queries.",
      "Optimize database performance.",
      "Maintain data integrity.",
    ],

    requirements: [
      "Strong SQL knowledge.",
      "PostgreSQL experience.",
      "Database design knowledge.",
      "Query optimization knowledge.",
    ],

    preferredQualifications: [
      "MongoDB familiarity.",
      "Backend development experience.",
    ],

    skills: [
      "SQL",
      "PostgreSQL",
      "MongoDB",
      "Database Design",
    ],

    keywords: [
      "database",
      "sql",
      "postgresql",
      "mongodb",
    ],

    education: [
      "Computer Science",
      "Information Technology",
    ],

    salary: 7600,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Cybersecurity Analyst",

    company:
      "SecureGrid",

    location:
      "Washington, DC",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "SecureGrid is hiring a Cybersecurity Analyst to monitor security systems and investigate potential threats.",

    responsibilities: [
      "Monitor security alerts.",
      "Investigate incidents.",
      "Perform vulnerability analysis.",
      "Document security findings.",
    ],

    requirements: [
      "Security fundamentals.",
      "Networking knowledge.",
      "Linux familiarity.",
      "Incident response fundamentals.",
    ],

    preferredQualifications: [
      "Security certification.",
      "Python knowledge.",
    ],

    skills: [
      "Cybersecurity",
      "Linux",
      "Networking",
      "Python",
    ],

    keywords: [
      "security",
      "cybersecurity",
      "linux",
      "networking",
    ],

    education: [
      "Cybersecurity",
      "Computer Science",
      "Information Technology",
    ],

    salary: 6100,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Systems Administrator",

    company:
      "NetOps",

    location:
      "Boston, MA",

    remoteType:
      "onsite",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "NetOps is seeking a Systems Administrator to maintain enterprise systems and user infrastructure.",

    responsibilities: [
      "Maintain servers.",
      "Manage user systems.",
      "Troubleshoot infrastructure.",
      "Monitor system performance.",
    ],

    requirements: [
      "Linux knowledge.",
      "Networking fundamentals.",
      "System troubleshooting skills.",
      "Basic scripting knowledge.",
    ],

    preferredQualifications: [
      "Cloud experience.",
      "Bash knowledge.",
    ],

    skills: [
      "Linux",
      "Networking",
      "Bash",
      "AWS",
    ],

    keywords: [
      "systems",
      "linux",
      "networking",
      "bash",
    ],

    education: [
      "Information Technology",
      "Computer Science",
    ],

    salary: 5600,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Technical Support Engineer",

    company:
      "SupportFlow",

    location:
      "Boston, MA",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "entry",

    description:
      "SupportFlow is looking for a Technical Support Engineer to help customers troubleshoot software and technical issues.",

    responsibilities: [
      "Troubleshoot customer issues.",
      "Document technical solutions.",
      "Investigate software problems.",
      "Work with engineering teams.",
    ],

    requirements: [
      "Strong troubleshooting skills.",
      "Basic networking knowledge.",
      "Communication skills.",
      "Understanding of web applications.",
    ],

    preferredQualifications: [
      "Linux familiarity.",
      "Programming fundamentals.",
    ],

    skills: [
      "Troubleshooting",
      "Networking",
      "Linux",
      "Communication",
    ],

    keywords: [
      "support",
      "technical support",
      "networking",
      "troubleshooting",
    ],

    education: [
      "Information Technology",
      "Computer Science",
    ],

    salary: 4300,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Mobile App Developer",

    company:
      "AppNova",

    location:
      "Los Angeles, CA",

    remoteType:
      "remote",

    employmentType:
      "full-time",

    experienceLevel:
      "mid",

    description:
      "AppNova is hiring a Mobile App Developer to create cross-platform mobile applications.",

    responsibilities: [
      "Develop mobile applications.",
      "Build reusable components.",
      "Integrate backend APIs.",
      "Improve application performance.",
    ],

    requirements: [
      "JavaScript experience.",
      "React experience.",
      "API integration experience.",
      "Git knowledge.",
    ],

    preferredQualifications: [
      "React Native experience.",
      "TypeScript knowledge.",
    ],

    skills: [
      "JavaScript",
      "React",
      "TypeScript",
      "REST API",
      "Git",
    ],

    keywords: [
      "mobile",
      "react",
      "javascript",
      "typescript",
      "api",
    ],

    education: [
      "Computer Science",
      "Software Engineering",
    ],

    salary: 7800,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },

  {
    title:
      "Technical Project Coordinator",

    company:
      "ProjectHive",

    location:
      "New York, NY",

    remoteType:
      "hybrid",

    employmentType:
      "full-time",

    experienceLevel:
      "junior",

    description:
      "ProjectHive is seeking a Technical Project Coordinator to support software development teams and project delivery.",

    responsibilities: [
      "Track project tasks.",
      "Coordinate development teams.",
      "Prepare project documentation.",
      "Support sprint planning.",
    ],

    requirements: [
      "Communication skills.",
      "Understanding of software development.",
      "Organization skills.",
      "Project coordination experience.",
    ],

    preferredQualifications: [
      "Agile knowledge.",
      "Technical background.",
    ],

    skills: [
      "Communication",
      "Project Management",
      "Agile",
      "Git",
    ],

    keywords: [
      "project",
      "agile",
      "software development",
      "coordination",
    ],

    education: [
      "Information Technology",
      "Computer Science",
      "Business",
    ],

    salary: 5100,

    source:
      "InterviewIQ",

    isActive: true,

    postedAt:
      new Date(),
  },
];

const seedJobs =
  async (): Promise<void> => {
    try {
      console.log(
        "Connecting to MongoDB..."
      );

      await mongoose.connect(
        env.MONGO_URI
      );

      console.log(
        "MongoDB connected."
      );

      const existingJobsCount =
        await Job.countDocuments({
          source:
            "InterviewIQ",
        });

      console.log(
        `Existing InterviewIQ jobs in database: ${existingJobsCount}`
      );

      if (
        existingJobsCount > 0
      ) {
        console.log(
          "Removing existing InterviewIQ jobs..."
        );

        await Job.deleteMany({
          source:
            "InterviewIQ",
        });

        console.log(
          "Existing InterviewIQ jobs removed."
        );
      }

      console.log(
        `Inserting ${jobs.length} jobs...`
      );

      const normalizedJobs: IJob[] =
        jobs.map(
          (job) => ({
            ...job,
            ...getExperienceRange(
              job.experienceLevel
            ),
          })
        );

      const insertedJobs =
        await Job.insertMany(
          normalizedJobs
        );

      console.log(
        `${insertedJobs.length} jobs inserted successfully.`
      );

      const totalJobs =
        await Job.countDocuments({
          source:
            "InterviewIQ",
        });

      console.log(
        `Total InterviewIQ jobs in database: ${totalJobs}`
      );

      await mongoose.connection.close();

      console.log(
        "MongoDB connection closed."
      );

      process.exit(0);
    } catch (error) {
      console.error(
        "Job seeding failed:"
      );

      console.error(
        error
      );

      try {
        await mongoose.connection.close();
      } catch {
        // intentionally ignored
      }

      process.exit(1);
    }
  };

void seedJobs();