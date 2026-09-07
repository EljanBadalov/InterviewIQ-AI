import dns from "node:dns";

import mongoose from "mongoose";

import {
  ResumeTemplate,
  type IResumeTemplate,
} from "../models/ResumeTemplate";

import { env } from "../config/env";

dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

const templates: IResumeTemplate[] = [
  {
    role: "penetration-tester",

    displayName:
      "Penetration Tester",

    aliases: [
      "Penetration Tester",
      "Red Team",
      "Red Team Analyst",
      "Ethical Hacker",
      "Security Tester",
      "Offensive Security Engineer",
    ],

    description:
      "Reference resume structure for penetration testing, Red Team and offensive cybersecurity roles.",

    professionalSummaryStyle: {
      minWords: 45,
      maxWords: 90,

      guidance: [
        "Introduce the candidate's information security or cybersecurity background.",
        "Highlight penetration testing and Red Team interests or experience.",
        "Mention network and application vulnerability assessment.",
        "Mention practical environments such as CTF platforms or security labs when genuinely supported.",
        "Include ethical responsibility, teamwork and attention to detail.",
      ],

      example:
        "Information security candidate focused on penetration testing and Red Team methodologies, with practical exposure to network and web application vulnerability assessment, security labs, CTF environments and ethical hacking principles.",
    },

    coreSkills: [
      "Penetration Testing",
      "Red Team",
      "Vulnerability Assessment",
      "Web Application Security",
      "Network Security",
      "Ethical Hacking",
      "OWASP Top 10",
      "Linux",
    ],

    technicalSkills: [
      "Kali Linux",
      "Parrot OS",
      "Metasploit Framework",
      "Burp Suite",
      "Nmap",
      "Wireshark",
      "Active Directory Pentesting",
      "Kerberoasting",
      "Pass-the-Hash",
      "OWASP Top 10",
      "Python",
      "Bash",
      "HackTheBox",
      "TryHackMe",
      "Social Engineering",
      "Phishing Simulation",
    ],

    softSkills: [
      "Analytical Thinking",
      "Critical Thinking",
      "Creative Problem Solving",
      "Attention to Detail",
      "Teamwork",
      "Knowledge Sharing",
      "Ethical Responsibility",
      "Confidentiality",
      "Working Under Pressure",
      "Continuous Learning",
    ],

    skillGroups: [
      {
        title: "Operating Systems",
        skills: [
          "Kali Linux",
          "Parrot OS",
        ],
      },

      {
        title: "Security Tools",
        skills: [
          "Metasploit Framework",
          "Burp Suite",
          "Nmap",
          "Wireshark",
        ],
      },

      {
        title:
          "Offensive Security",

        skills: [
          "Penetration Testing",
          "Active Directory Pentesting",
          "Kerberoasting",
          "Pass-the-Hash",
          "OWASP Top 10",
          "Social Engineering",
          "Phishing Simulation",
        ],
      },

      {
        title: "Programming",
        skills: [
          "Python",
          "Bash",
        ],
      },

      {
        title:
          "Practical Platforms",

        skills: [
          "HackTheBox",
          "TryHackMe",
          "CTF",
        ],
      },
    ],

    atsKeywords: [
      "penetration testing",
      "red team",
      "ethical hacking",
      "vulnerability assessment",
      "web application security",
      "network security",
      "kali linux",
      "metasploit",
      "burp suite",
      "nmap",
      "wireshark",
      "active directory",
      "owasp top 10",
      "python",
      "bash",
      "hackthebox",
      "tryhackme",
      "ctf",
    ],

    sections: [
      {
        type: "summary",
        title:
          "Professional Profile",
        order: 1,
        required: true,

        guidance: [
          "Keep the profile concise and focused on security specialization.",
          "Mention practical penetration testing evidence rather than unsupported expertise.",
        ],

        exampleBullets: [],
      },

      {
        type: "skills",
        title:
          "Technical Skills",
        order: 2,
        required: true,

        guidance: [
          "Group operating systems, tools, offensive techniques and scripting skills.",
        ],

        exampleBullets: [],
      },

      {
        type: "achievements",
        title:
          "Core Competencies",
        order: 3,
        required: false,

        guidance: [
          "Include analytical thinking, teamwork, ethics and attention to detail.",
        ],

        exampleBullets: [],
      },

      {
        type: "experience",
        title:
          "Experience",
        order: 4,
        required: true,

        guidance: [
          "Describe vulnerability scanning, reporting, monitoring or security club activities.",
          "Use factual security responsibilities and measurable scope when available.",
        ],

        exampleBullets: [
          "Supported basic vulnerability scanning activities in an internal network environment.",
          "Assisted with preparation of vulnerability findings and security reports.",
          "Supported network traffic monitoring and analysis activities.",
        ],
      },

      {
        type: "projects",
        title:
          "Projects",
        order: 5,
        required: true,

        guidance: [
          "Prioritize penetration testing labs, CTF activity and vulnerability assessment projects.",
        ],

        exampleBullets: [
          "Executed a complete penetration-testing scenario in a virtual lab environment.",
          "Prepared a vulnerability report based on OWASP methodology.",
          "Completed practical exploitation challenges on cybersecurity training platforms.",
        ],
      },

      {
        type: "certifications",
        title:
          "Certifications",
        order: 6,
        required: false,

        guidance: [
          "Clearly distinguish completed certifications from those still in progress.",
        ],

        exampleBullets: [],
      },

      {
        type: "education",
        title:
          "Education",
        order: 7,
        required: true,

        guidance: [],
        exampleBullets: [],
      },

      {
        type: "other",
        title:
          "Languages",
        order: 8,
        required: false,

        guidance: [],
        exampleBullets: [],
      },
    ],

    experiencePatterns: [
      {
        title:
          "Vulnerability Assessment",

        description:
          "Describe the environment, assessment activity and reporting contribution.",

        examples: [
          "Supported vulnerability scanning and documented identified weaknesses in a controlled environment.",
        ],
      },

      {
        title:
          "Security Leadership",

        description:
          "Use cybersecurity clubs, CTF activities and knowledge sharing as evidence where relevant.",

        examples: [
          "Organized and moderated recurring CTF practice sessions for students.",
        ],
      },
    ],

    projectPatterns: [
      "Vulnerability assessment simulation",
      "Virtual penetration testing laboratory",
      "OWASP vulnerability report",
      "HackTheBox profile",
      "TryHackMe profile",
      "CTF participation",
      "Web exploitation project",
    ],

    educationPatterns: [
      "Computer Science",
      "Information Security",
      "Cybersecurity",
      "Information Technology",
    ],

    certificationPatterns: [
      "CompTIA Security+",
      "TryHackMe Jr Penetration Tester Path",
      "Google Cybersecurity Professional Certificate",
    ],

    formattingRules: [
      "Keep contact information at the top.",
      "Use a clear professional profile section.",
      "Place technical skills before experience.",
      "Keep projects separate from professional experience.",
      "Use clear section headings.",
      "Use an ATS-friendly text-first layout.",
    ],

    resumeWritingRules: [
      "Never claim tools or attacks the candidate has not actually used.",
      "Do not present certifications in progress as completed.",
      "Use practical labs and CTF activities as evidence for entry-level candidates.",
      "Prioritize security-specific terminology from the target vacancy.",
    ],

    recommendedForRoles: [
      "Penetration Tester",
      "Red Team Analyst",
      "Ethical Hacker",
      "Junior Penetration Tester",
      "Offensive Security Engineer",
      "Security Consultant",
    ],

    sourceFileName:
      "1-Penetration Tester CV.docx",

    version: 2,

    isActive: true,
  },

  {
    role: "soc-analyst",

    displayName:
      "SOC Analyst",

    aliases: [
      "SOC Analyst",
      "Security Operations Center Analyst",
      "Cybersecurity Analyst",
      "Security Analyst",
      "Blue Team Analyst",
    ],

    description:
      "Reference resume structure for SOC monitoring, incident triage, defensive security and Blue Team roles.",

    professionalSummaryStyle: {
      minWords: 45,
      maxWords: 90,

      guidance: [
        "Focus on SOC operations, security monitoring and incident response.",
        "Highlight SIEM and log analysis.",
        "Mention MITRE ATT&CK knowledge where supported.",
        "Show attention to detail, documentation and fast decision-making.",
      ],

      example:
        "IT security candidate focused on SOC operations, event monitoring and incident response, with practical exposure to SIEM platforms, log analysis and the MITRE ATT&CK framework.",
    },

    coreSkills: [
      "SOC Operations",
      "Security Monitoring",
      "Incident Response",
      "Incident Triage",
      "SIEM",
      "Log Analysis",
      "Threat Detection",
      "MITRE ATT&CK",
      "Network Traffic Analysis",
    ],

    technicalSkills: [
      "Splunk",
      "ELK Stack",
      "Elastic",
      "Logstash",
      "Kibana",
      "Snort",
      "Suricata",
      "Wireshark",
      "Windows Server",
      "Linux",
      "MITRE ATT&CK",
      "Log Analysis",
      "Incident Triage",
      "Python",
      "Bash",
      "Nessus",
      "Sysmon",
    ],

    softSkills: [
      "Attention to Detail",
      "Observation",
      "Decision Making",
      "Working Under Pressure",
      "Technical Documentation",
      "Team Collaboration",
      "Prioritization",
    ],

    skillGroups: [
      {
        title: "SIEM",
        skills: [
          "Splunk",
          "ELK Stack",
          "Elastic",
          "Logstash",
          "Kibana",
        ],
      },

      {
        title:
          "Detection & Monitoring",

        skills: [
          "Snort",
          "Suricata",
          "Sysmon",
          "Log Analysis",
          "Incident Triage",
        ],
      },

      {
        title:
          "Network Analysis",

        skills: [
          "Wireshark",
          "Network Traffic Analysis",
        ],
      },

      {
        title:
          "Systems & Scripting",

        skills: [
          "Windows Server",
          "Linux",
          "Python",
          "Bash",
        ],
      },
    ],

    atsKeywords: [
      "soc analyst",
      "security monitoring",
      "incident response",
      "incident triage",
      "siem",
      "splunk",
      "elk stack",
      "log analysis",
      "mitre att&ck",
      "wireshark",
      "snort",
      "suricata",
      "sysmon",
      "nessus",
      "blue team",
    ],

    sections: [
      {
        type: "summary",
        title:
          "Professional Profile",
        order: 1,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "skills",
        title:
          "Technical Skills",
        order: 2,
        required: true,

        guidance: [
          "Group SIEM, monitoring, network analysis, operating systems and scripting.",
        ],

        exampleBullets: [],
      },

      {
        type: "achievements",
        title:
          "Core Competencies",
        order: 3,
        required: false,

        guidance: [],
        exampleBullets: [],
      },

      {
        type: "experience",
        title:
          "Experience",
        order: 4,
        required: true,

        guidance: [
          "Highlight security alert triage, suspicious activity documentation and incident-response collaboration.",
        ],

        exampleBullets: [
          "Supported initial triage of daily security alerts.",
          "Assisted with documenting suspicious activity in SIEM systems.",
          "Worked with incident-response teams during investigation activities.",
        ],
      },

      {
        type: "projects",
        title:
          "Projects",
        order: 5,
        required: true,

        guidance: [
          "Use home SOC labs, vulnerability analysis and Blue Team competitions as practical evidence.",
        ],

        exampleBullets: [
          "Built a small SOC monitoring environment using Splunk and Sysmon.",
          "Simulated test attacks and created corresponding alert rules.",
          "Performed test-environment vulnerability discovery and prioritization with Nessus.",
        ],
      },

      {
        type: "certifications",
        title:
          "Certifications",
        order: 6,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "education",
        title:
          "Education",
        order: 7,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "other",
        title:
          "Languages",
        order: 8,
        required: false,
        guidance: [],
        exampleBullets: [],
      },
    ],

    experiencePatterns: [
      {
        title:
          "Alert Triage",

        description:
          "Show alert monitoring, initial analysis, documentation and escalation.",

        examples: [
          "Performed initial triage of security alerts and documented suspicious events for further investigation.",
        ],
      },

      {
        title:
          "Incident Collaboration",

        description:
          "Highlight participation with incident-response teams without overstating ownership.",

        examples: [
          "Supported incident-response activities through investigation documentation and event analysis.",
        ],
      },
    ],

    projectPatterns: [
      "Home SOC lab",
      "Splunk monitoring environment",
      "Sysmon logging",
      "Attack simulation",
      "Alert-rule creation",
      "Nessus vulnerability analysis",
      "Blue Team competition",
    ],

    educationPatterns: [
      "Information Security",
      "Cybersecurity",
      "Computer Science",
      "Information Technology",
    ],

    certificationPatterns: [
      "CompTIA Security+",
      "Blue Team Level 1",
      "Splunk Fundamentals",
    ],

    formattingRules: [
      "Keep technical skills above experience.",
      "Separate practical security projects from work experience.",
      "Use simple ATS-readable headings.",
      "Keep certification status accurate.",
    ],

    resumeWritingRules: [
      "Do not describe participation as full incident ownership unless supported.",
      "Use SOC vocabulary such as alert triage, logs, SIEM and incident response when truthful.",
      "Use practical labs as evidence for junior candidates.",
    ],

    recommendedForRoles: [
      "SOC Analyst",
      "Junior SOC Analyst",
      "Security Analyst",
      "Cybersecurity Analyst",
      "Blue Team Analyst",
    ],

    sourceFileName:
      "2-SOC Analyst CV.docx",

    version: 2,

    isActive: true,
  },

  {
    role: "full-stack-developer",

    displayName:
      "Full-Stack Developer",

    aliases: [
      "Full Stack Developer",
      "Full Stack Engineer",
      "MERN Developer",
      "Web Developer",
      "Full Stack Software Engineer",
    ],

    description:
      "Reference resume structure for frontend and backend web application development roles.",

    professionalSummaryStyle: {
      minWords: 40,
      maxWords: 85,

      guidance: [
        "Mention both frontend and backend development.",
        "Highlight practical project experience.",
        "Mention the strongest frameworks, database technologies and application-development stack.",
        "Show ability to work productively in teams and learn quickly.",
      ],

      example:
        "Computer Science candidate with practical experience building modern web applications across frontend and backend technologies, including React, Node.js and database-driven application development.",
    },

    coreSkills: [
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "Express",
      "REST API",
      "MongoDB",
      "PostgreSQL",
      "Git",
    ],

    technicalSkills: [
      "JavaScript ES6+",
      "TypeScript",
      "React.js",
      "Next.js",
      "HTML5",
      "CSS3",
      "Tailwind CSS",
      "Node.js",
      "Express.js",
      "MongoDB",
      "PostgreSQL",
      "MySQL",
      "RESTful API",
      "GraphQL",
      "Git",
      "GitHub",
      "CI/CD",
      "Docker",
      "Firebase",
      "Stripe",
      "Vercel",
    ],

    softSkills: [
      "Problem Solving",
      "Teamwork",
      "Agile",
      "Scrum",
      "Time Management",
      "Creative Thinking",
      "Adaptability",
      "Communication",
      "Self Learning",
    ],

    skillGroups: [
      {
        title: "Frontend",
        skills: [
          "JavaScript",
          "TypeScript",
          "React.js",
          "Next.js",
          "HTML5",
          "CSS3",
          "Tailwind CSS",
        ],
      },

      {
        title: "Backend",
        skills: [
          "Node.js",
          "Express.js",
          "RESTful API",
          "GraphQL",
        ],
      },

      {
        title: "Databases",
        skills: [
          "MongoDB",
          "PostgreSQL",
          "MySQL",
          "Firebase",
        ],
      },

      {
        title:
          "Development Tools",

        skills: [
          "Git",
          "GitHub",
          "CI/CD",
          "Docker",
          "Vercel",
        ],
      },
    ],

    atsKeywords: [
      "full stack developer",
      "frontend",
      "backend",
      "javascript",
      "typescript",
      "react",
      "next.js",
      "node.js",
      "express",
      "mongodb",
      "postgresql",
      "mysql",
      "rest api",
      "graphql",
      "git",
      "docker",
      "ci/cd",
    ],

    sections: [
      {
        type: "summary",
        title:
          "Professional Profile",
        order: 1,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "skills",
        title:
          "Technical Skills",
        order: 2,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "achievements",
        title:
          "Core Competencies",
        order: 3,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "experience",
        title:
          "Experience",
        order: 4,
        required: true,

        guidance: [
          "Highlight both frontend and backend contributions.",
          "Include code review, client requirements or team collaboration when relevant.",
        ],

        exampleBullets: [
          "Supported development of an internal management dashboard using React.",
          "Contributed to Node.js and Express REST API development.",
          "Participated in code review workflows.",
        ],
      },

      {
        type: "projects",
        title:
          "Projects",
        order: 5,
        required: true,

        guidance: [
          "Show complete applications and the stack used.",
          "Mention major features and deployment where relevant.",
        ],

        exampleBullets: [
          "Built an e-commerce platform using React, Node.js, Express and MongoDB.",
          "Implemented authentication, shopping-cart functionality and test payment integration.",
          "Developed and deployed a personal portfolio using Next.js and Tailwind CSS.",
        ],
      },

      {
        type: "certifications",
        title:
          "Certifications",
        order: 6,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "education",
        title:
          "Education",
        order: 7,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "other",
        title:
          "Languages",
        order: 8,
        required: false,
        guidance: [],
        exampleBullets: [],
      },
    ],

    experiencePatterns: [
      {
        title:
          "Frontend Contribution",

        description:
          "Describe interface or component work, technology used and product context.",

        examples: [
          "Developed React-based interface components for an internal management dashboard.",
        ],
      },

      {
        title:
          "Backend Contribution",

        description:
          "Describe APIs, services and database interactions.",

        examples: [
          "Contributed to Node.js and Express REST API development for application features.",
        ],
      },

      {
        title:
          "Freelance Delivery",

        description:
          "Show client requirements, technical solution and delivered website or application.",

        examples: [
          "Built responsive websites for small-business clients based on analyzed requirements.",
        ],
      },
    ],

    projectPatterns: [
      "E-commerce platform",
      "User authentication",
      "Shopping cart",
      "Payment integration",
      "Task management application",
      "React Firebase application",
      "Next.js portfolio",
      "Vercel deployment",
    ],

    educationPatterns: [
      "Computer Science",
      "Software Engineering",
      "Information Technology",
    ],

    certificationPatterns: [
      "Meta Front-End Developer Professional Certificate",
      "freeCodeCamp Full Stack Development Certification",
      "The Odin Project Full Stack JavaScript",
    ],

    formattingRules: [
      "Place the technology stack high on the resume.",
      "Keep projects as a dedicated section.",
      "Mention deployment and production tools when genuinely used.",
      "Use standard ATS-readable headings.",
    ],

    resumeWritingRules: [
      "Mention technology inside project and experience bullets.",
      "Do not add frameworks simply because the target job requests them.",
      "Prioritize complete applications over isolated skill claims.",
      "Use projects as evidence when professional experience is limited.",
    ],

    recommendedForRoles: [
      "Full Stack Developer",
      "Frontend Developer",
      "Backend Developer",
      "React Developer",
      "Node.js Developer",
      "Web Developer",
      "MERN Developer",
    ],

    sourceFileName:
      "3-Full-Stack Developer CV.docx",

    version: 2,

    isActive: true,
  },

  {
    role: "software-engineer",

    displayName:
      "Software Engineer",

    aliases: [
      "Software Engineer",
      "Software Developer",
      "Junior Software Engineer",
      "Application Developer",
      "Backend Engineer",
    ],

    description:
      "Reference resume structure emphasizing computer science fundamentals, engineering practices and scalable software development.",

    professionalSummaryStyle: {
      minWords: 40,
      maxWords: 85,

      guidance: [
        "Highlight algorithms, data structures and software design fundamentals.",
        "Mention object-oriented programming.",
        "Show team experience and Agile exposure.",
        "Focus on maintainable and scalable code.",
      ],

      example:
        "Computer Science candidate with strong foundations in algorithms, data structures and software design, familiar with object-oriented programming, Agile collaboration and building maintainable software.",
    },

    coreSkills: [
      "Java",
      "C++",
      "Python",
      "Data Structures",
      "Algorithms",
      "Object-Oriented Programming",
      "SQL",
      "Git",
      "Linux",
      "System Design",
    ],

    technicalSkills: [
      "Java",
      "C++",
      "Python",
      "Data Structures",
      "Algorithms",
      "OOP",
      "SQL",
      "Database Design",
      "Git",
      "GitHub",
      "Linux",
      "System Design",
      "JavaScript",
      "MySQL",
    ],

    softSkills: [
      "Analytical Thinking",
      "Teamwork",
      "Agile",
      "Scrum",
      "Attention to Detail",
      "Time Management",
      "Continuous Learning",
      "Communication",
      "Problem Solving",
    ],

    skillGroups: [
      {
        title:
          "Programming Languages",

        skills: [
          "Java",
          "C++",
          "Python",
          "JavaScript",
        ],
      },

      {
        title:
          "Computer Science",

        skills: [
          "Data Structures",
          "Algorithms",
          "OOP",
          "System Design",
        ],
      },

      {
        title:
          "Data & Systems",

        skills: [
          "SQL",
          "Database Design",
          "MySQL",
          "Linux",
        ],
      },

      {
        title:
          "Development Tools",

        skills: [
          "Git",
          "GitHub",
        ],
      },
    ],

    atsKeywords: [
      "software engineer",
      "software development",
      "java",
      "c++",
      "python",
      "data structures",
      "algorithms",
      "object oriented programming",
      "oop",
      "sql",
      "git",
      "linux",
      "system design",
      "agile",
      "scrum",
    ],

    sections: [
      {
        type: "summary",
        title:
          "Professional Profile",
        order: 1,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "skills",
        title:
          "Technical Skills",
        order: 2,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "achievements",
        title:
          "Core Competencies",
        order: 3,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "experience",
        title:
          "Experience",
        order: 4,
        required: true,

        guidance: [
          "Highlight coding, testing, debugging, optimization and team development.",
        ],

        exampleBullets: [
          "Developed and tested small backend modules as part of an engineering team.",
          "Contributed to bug fixes and optimization in an existing codebase.",
          "Participated in Agile/Scrum stand-up meetings.",
        ],
      },

      {
        type: "projects",
        title:
          "Projects",
        order: 5,
        required: true,

        guidance: [
          "Use academic and personal projects to demonstrate CS fundamentals.",
        ],

        exampleBullets: [
          "Built an algorithm visualizer demonstrating sorting and searching algorithms.",
          "Developed a library management system using Java and MySQL.",
          "Strengthened problem-solving skills through competitive programming practice.",
        ],
      },

      {
        type: "certifications",
        title:
          "Certifications",
        order: 6,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "education",
        title:
          "Education",
        order: 7,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "other",
        title:
          "Languages",
        order: 8,
        required: false,
        guidance: [],
        exampleBullets: [],
      },
    ],

    experiencePatterns: [
      {
        title:
          "Engineering Contribution",

        description:
          "Describe development, testing, debugging or optimization work.",

        examples: [
          "Developed and tested backend modules while contributing to bug fixes and code optimization.",
        ],
      },

      {
        title:
          "Research Experience",

        description:
          "Use academic research where it demonstrates technical depth.",

        examples: [
          "Supported academic research focused on algorithm efficiency.",
        ],
      },
    ],

    projectPatterns: [
      "Algorithm visualizer",
      "Sorting algorithms",
      "Search algorithms",
      "Java application",
      "MySQL application",
      "Capstone project",
      "LeetCode",
      "Competitive programming",
    ],

    educationPatterns: [
      "Computer Science",
      "Software Engineering",
      "Information Technology",
    ],

    certificationPatterns: [
      "CS50",
      "Data Structures and Algorithms Specialization",
    ],

    formattingRules: [
      "Keep CS fundamentals prominent for junior candidates.",
      "Separate technical skills and projects.",
      "Use readable ATS-friendly headings.",
      "Place projects before education when they provide stronger evidence.",
    ],

    resumeWritingRules: [
      "Use project evidence to support algorithm or programming skills.",
      "Avoid generic claims of scalable systems without real examples.",
      "Mention testing, optimization and debugging when actually performed.",
    ],

    recommendedForRoles: [
      "Software Engineer",
      "Junior Software Engineer",
      "Software Developer",
      "Backend Developer",
      "Application Developer",
    ],

    sourceFileName:
      "4-Software Engineer CV.docx",

    version: 2,

    isActive: true,
  },

  {
    role:
      "machine-learning-engineer",

    displayName:
      "Machine Learning Engineer",

    aliases: [
      "Machine Learning Engineer",
      "ML Engineer",
      "AI Engineer",
      "Applied Machine Learning Engineer",
      "Machine Learning Developer",
    ],

    description:
      "Reference resume structure for machine learning model development, experimentation and deployment roles.",

    professionalSummaryStyle: {
      minWords: 45,
      maxWords: 90,

      guidance: [
        "Mention model development, training and production deployment.",
        "Highlight the Python ML ecosystem.",
        "Show understanding of the complete lifecycle from preprocessing through model deployment.",
      ],

      example:
        "Computer Science candidate with practical project experience developing, training and deploying machine learning models using Python, TensorFlow, PyTorch and scikit-learn across the full ML lifecycle.",
    },

    coreSkills: [
      "Python",
      "Machine Learning",
      "Data Preprocessing",
      "Feature Engineering",
      "Deep Learning",
      "Model Evaluation",
      "Model Deployment",
      "SQL",
    ],

    technicalSkills: [
      "Python",
      "NumPy",
      "Pandas",
      "TensorFlow",
      "PyTorch",
      "Scikit-learn",
      "Data Preprocessing",
      "Feature Engineering",
      "CNN",
      "RNN",
      "Flask",
      "FastAPI",
      "SQL",
      "Jupyter Notebook",
      "Google Colab",
      "Keras",
      "NLTK",
    ],

    softSkills: [
      "Analytical Thinking",
      "Scientific Thinking",
      "Systematic Problem Solving",
      "Teamwork",
      "Accuracy",
      "Patience",
      "Continuous Learning",
      "Technical Communication",
    ],

    skillGroups: [
      {
        title:
          "Programming & Data",

        skills: [
          "Python",
          "NumPy",
          "Pandas",
          "SQL",
        ],
      },

      {
        title:
          "Machine Learning",

        skills: [
          "TensorFlow",
          "PyTorch",
          "Scikit-learn",
          "Keras",
        ],
      },

      {
        title:
          "ML Workflow",

        skills: [
          "Data Preprocessing",
          "Feature Engineering",
          "Model Evaluation",
          "CNN",
          "RNN",
        ],
      },

      {
        title:
          "Deployment & Tools",

        skills: [
          "Flask",
          "FastAPI",
          "Jupyter Notebook",
          "Google Colab",
        ],
      },
    ],

    atsKeywords: [
      "machine learning engineer",
      "machine learning",
      "python",
      "tensorflow",
      "pytorch",
      "scikit-learn",
      "data preprocessing",
      "feature engineering",
      "deep learning",
      "cnn",
      "rnn",
      "model deployment",
      "flask",
      "fastapi",
      "model evaluation",
    ],

    sections: [
      {
        type: "summary",
        title:
          "Professional Profile",
        order: 1,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "skills",
        title:
          "Technical Skills",
        order: 2,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "achievements",
        title:
          "Core Competencies",
        order: 3,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "experience",
        title:
          "Experience",
        order: 4,
        required: true,

        guidance: [
          "Highlight preprocessing, model training, evaluation and research.",
        ],

        exampleBullets: [
          "Supported data cleaning and preprocessing workflows.",
          "Assisted with training small-scale classification models.",
          "Evaluated model performance and prepared analysis reports.",
        ],
      },

      {
        type: "projects",
        title:
          "Projects",
        order: 5,
        required: true,

        guidance: [
          "Mention the model type, framework and measured results.",
        ],

        exampleBullets: [
          "Built an image classification model using CNN architecture with TensorFlow/Keras.",
          "Developed a sentiment-analysis model using scikit-learn and NLTK.",
          "Participated in data-science competitions and model optimization.",
        ],
      },

      {
        type: "certifications",
        title:
          "Certifications",
        order: 6,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "education",
        title:
          "Education",
        order: 7,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "other",
        title:
          "Languages",
        order: 8,
        required: false,
        guidance: [],
        exampleBullets: [],
      },
    ],

    experiencePatterns: [
      {
        title:
          "Model Training",

        description:
          "State preprocessing, model family, framework and evaluation activity.",

        examples: [
          "Prepared data and supported training and evaluation of classification models using Python-based ML tools.",
        ],
      },

      {
        title:
          "Research Activity",

        description:
          "Use academic AI research and experiment replication where relevant.",

        examples: [
          "Reviewed academic AI research and reproduced selected experiments in a university laboratory.",
        ],
      },
    ],

    projectPatterns: [
      "Image classification",
      "CNN",
      "TensorFlow",
      "Keras",
      "Sentiment analysis",
      "NLP",
      "Scikit-learn",
      "NLTK",
      "Kaggle competition",
      "Model optimization",
    ],

    educationPatterns: [
      "Computer Science",
      "Artificial Intelligence",
      "Machine Learning",
      "Data Science",
      "Mathematics",
    ],

    certificationPatterns: [
      "Deep Learning Specialization",
      "Machine Learning by Andrew Ng",
      "TensorFlow Developer Certificate",
    ],

    formattingRules: [
      "Show the ML lifecycle clearly.",
      "Keep frameworks and preprocessing skills visible.",
      "Include model metrics only when actually measured.",
      "Separate projects from work experience.",
    ],

    resumeWritingRules: [
      "Never fabricate accuracy, F1 score or other model metrics.",
      "Mention deployment only if the candidate has actually deployed a model.",
      "Use model projects as evidence of ML skill.",
      "Keep in-progress certifications clearly marked.",
    ],

    recommendedForRoles: [
      "Machine Learning Engineer",
      "Junior Machine Learning Engineer",
      "ML Engineer",
      "AI Engineer",
      "Applied ML Engineer",
    ],

    sourceFileName:
      "5-Machine Learning Engineer CV.docx",

    version: 2,

    isActive: true,
  },

  {
    role:
      "data-scientist",

    displayName:
      "Data Scientist",

    aliases: [
      "Data Scientist",
      "Junior Data Scientist",
      "Data Analyst",
      "Analytics Specialist",
      "Analytics Scientist",
    ],

    description:
      "Reference resume structure for data analysis, statistics, visualization and applied data science roles.",

    professionalSummaryStyle: {
      minWords: 40,
      maxWords: 90,

      guidance: [
        "Highlight data analysis, statistical modeling and visualization.",
        "Mention Python and SQL.",
        "Explain ability to convert raw data into useful insights.",
        "Connect analysis with business decision support where relevant.",
      ],

      example:
        "Computer Science or Statistics candidate with practical experience in data analysis, statistical modeling and visualization, using Python and SQL to turn raw data into actionable insights and analytical reports.",
    },

    coreSkills: [
      "Python",
      "SQL",
      "Data Analysis",
      "Statistical Analysis",
      "Hypothesis Testing",
      "Data Visualization",
      "Machine Learning",
      "A/B Testing",
      "Excel",
    ],

    technicalSkills: [
      "Python",
      "Pandas",
      "NumPy",
      "R",
      "SQL",
      "Statistical Analysis",
      "Hypothesis Testing",
      "Matplotlib",
      "Seaborn",
      "Power BI",
      "Tableau",
      "Scikit-learn",
      "A/B Testing",
      "Excel",
      "Time Series",
      "EDA",
    ],

    softSkills: [
      "Analytical Thinking",
      "Attention to Detail",
      "Data Storytelling",
      "Teamwork",
      "Critical Thinking",
      "Time Management",
      "Communication",
    ],

    skillGroups: [
      {
        title:
          "Programming & Analysis",

        skills: [
          "Python",
          "Pandas",
          "NumPy",
          "R",
          "SQL",
        ],
      },

      {
        title:
          "Statistics",

        skills: [
          "Statistical Analysis",
          "Hypothesis Testing",
          "A/B Testing",
          "Time Series",
        ],
      },

      {
        title:
          "Visualization",

        skills: [
          "Matplotlib",
          "Seaborn",
          "Power BI",
          "Tableau",
          "Excel",
        ],
      },

      {
        title:
          "Machine Learning",

        skills: [
          "Scikit-learn",
          "Machine Learning",
          "EDA",
        ],
      },
    ],

    atsKeywords: [
      "data scientist",
      "data analyst",
      "python",
      "sql",
      "pandas",
      "numpy",
      "statistics",
      "hypothesis testing",
      "data visualization",
      "power bi",
      "tableau",
      "scikit-learn",
      "a/b testing",
      "excel",
      "time series",
      "eda",
    ],

    sections: [
      {
        type: "summary",
        title:
          "Professional Profile",
        order: 1,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "skills",
        title:
          "Technical Skills",
        order: 2,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "achievements",
        title:
          "Core Competencies",
        order: 3,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "experience",
        title:
          "Experience",
        order: 4,
        required: true,

        guidance: [
          "Highlight data cleaning, analysis, dashboarding and reporting.",
        ],

        exampleBullets: [
          "Cleaned and analyzed sales datasets.",
          "Built management dashboards using Power BI.",
          "Presented recurring analytical reports to team members.",
          "Supported statistical analysis of survey data.",
        ],
      },

      {
        type: "projects",
        title:
          "Projects",
        order: 5,
        required: true,

        guidance: [
          "Include analytical method, tool and output.",
        ],

        exampleBullets: [
          "Developed a sales forecasting model using time-series analysis.",
          "Built an interactive analytics dashboard using Tableau.",
          "Performed exploratory data analysis and modeling on open datasets.",
        ],
      },

      {
        type: "certifications",
        title:
          "Certifications",
        order: 6,
        required: false,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "education",
        title:
          "Education",
        order: 7,
        required: true,
        guidance: [],
        exampleBullets: [],
      },

      {
        type: "other",
        title:
          "Languages",
        order: 8,
        required: false,
        guidance: [],
        exampleBullets: [],
      },
    ],

    experiencePatterns: [
      {
        title:
          "Data Analysis",

        description:
          "Describe the dataset, analytical activity, tool and resulting output.",

        examples: [
          "Cleaned and analyzed sales data and prepared recurring analytical reports.",
        ],
      },

      {
        title:
          "Dashboarding",

        description:
          "Describe visualization tool and decision-support purpose.",

        examples: [
          "Built Power BI dashboards to support management reporting.",
        ],
      },

      {
        title:
          "Academic Research",

        description:
          "Use research-assistant work to demonstrate statistical analysis.",

        examples: [
          "Supported statistical analysis of survey data as part of an academic research project.",
        ],
      },
    ],

    projectPatterns: [
      "Sales forecasting",
      "Time-series analysis",
      "Interactive dashboard",
      "Tableau",
      "Power BI",
      "Kaggle",
      "Exploratory data analysis",
      "Predictive modeling",
    ],

    educationPatterns: [
      "Data Science",
      "Statistics",
      "Computer Science",
      "Mathematics",
    ],

    certificationPatterns: [
      "Google Data Analytics Professional Certificate",
      "IBM Data Science Professional Certificate",
      "Microsoft Power BI Data Analyst Associate",
    ],

    formattingRules: [
      "Keep analysis and visualization technologies easy to scan.",
      "Separate projects from experience.",
      "Use clear ATS-readable headings.",
      "State certification-in-progress status accurately.",
    ],

    resumeWritingRules: [
      "Show analytical outputs rather than only listing tools.",
      "Never fabricate business impact or model accuracy.",
      "Use dashboards, reports and projects as evidence.",
      "Use data storytelling language where genuinely supported.",
    ],

    recommendedForRoles: [
      "Data Scientist",
      "Junior Data Scientist",
      "Data Analyst",
      "Business Data Analyst",
      "Analytics Specialist",
    ],

    sourceFileName:
      "6-Data Scientist CV.docx",

    version: 2,

    isActive: true,
  },
];

const seedResumeTemplates =
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

      const existingCount =
        await ResumeTemplate.countDocuments();

      console.log(
        `Existing resume templates: ${existingCount}`
      );

      if (existingCount > 0) {
        console.log(
          "Removing existing resume templates..."
        );

        await ResumeTemplate.deleteMany(
          {}
        );

        console.log(
          "Existing resume templates removed."
        );
      }

      console.log(
        `Inserting ${templates.length} real resume reference templates...`
      );

      const inserted =
        await ResumeTemplate.insertMany(
          templates
        );

      console.log(
        `${inserted.length} resume templates inserted successfully.`
      );

      console.log("");

      for (const template of inserted) {
        console.log(
          `✓ ${template.displayName} | v${template.version} | ${template.sourceFileName}`
        );
      }

      console.log("");

      const total =
        await ResumeTemplate.countDocuments();

      console.log(
        `Total resume templates in database: ${total}`
      );

      await mongoose.connection.close();

      console.log(
        "MongoDB connection closed."
      );

      process.exit(0);
    } catch (error) {
      console.error(
        "Resume template seeding failed:"
      );

      console.error(error);

      try {
        await mongoose.connection.close();
      } catch {}

      process.exit(1);
    }
  };

void seedResumeTemplates();