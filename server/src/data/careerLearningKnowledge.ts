import { SUPPLEMENTAL_GUIDANCE_ROWS, SUPPLEMENTAL_GUIDANCE_VERSION } from './careerLearningGuidance';
import { createHash } from 'node:crypto';
/** Versioned reference curricula, never user proficiency or persisted seed data. */
export const LEARNING_KNOWLEDGE_VERSION = 'career-learning-v1';
export interface LearningTopic {
    id: string; name: string; level: 'beginner' | 'intermediate' | 'advanced';
    prerequisites: string[]; subtopics: string[]; exercise: string; proof: string;
    curated?: boolean; guidanceSource?: 'reference-pack' | 'career-knowledge' | 'combined';
}
type GuideRow = [string, string, string, string, string];
// Each exercise has an observable check; alternative stacks are not mutual prerequisites.
const rows: GuideRow[] = [
 ['programming','Programming Fundamentals','Variables, control flow, functions|Collections and error handling','Build a command-line expense tracker with input validation','Pass 6 checks covering empty input, invalid amounts, totals and persistence'],
 ['git','Git','Commits and branches|Merge conflicts and rollback','Create a feature branch, resolve a deliberate conflict and revert one commit','Show a clean merge and a revert that preserves the unrelated feature'],
 ['http','HTTP','Requests, status codes and headers|Timeouts and idempotency','Inspect a form submission and reproduce success, validation and timeout responses','Explain a captured request and demonstrate 200, 400 and retry-safe behavior'],
 ['sql','SQL','SELECT and JOIN|Grouping, NULL and constraints','Model orders and customers; write joins and aggregate revenue queries','Pass 6 queries including customers with no orders and duplicate order protection'],
 ['javascript','JavaScript','Functions and closures|Promises and event loop','Build a cancellable search with debouncing and explicit error handling','Tests prove latest-result wins, cancellation and error recovery'],
 ['html','HTML','Semantic document structure|Forms and keyboard accessibility','Build a semantic signup form with labels and native validation','Complete every input by keyboard and associate every error with its field'],
 ['css','CSS','Box model and layout|Responsive design and focus styles','Build a responsive card grid with visible keyboard focus','Verify 320px and 1280px widths without overflow and usable focus order'],
 ['python','Python','Collections and functions|Exceptions and modules','Parse a CSV expense file and report validated category totals','Tests cover missing columns, invalid rows and deterministic totals'],
 ['linux','Linux','Files and permissions|Processes, pipes and signals','Run a service under a restricted user and inspect its process and logs','Demonstrate denied privileged writes and graceful process termination'],
 ['networking','Networking','IP, DNS and TCP|TLS and routing','Trace a local HTTPS request through DNS, connection and certificate checks','Explain a failed DNS lookup, refused connection and invalid certificate separately'],
 ['statistics','Statistics','Sampling and distributions|Uncertainty and hypothesis testing','Analyze an experiment with effect size and confidence intervals','Report sample size, interval and limitations without claiming causation from correlation'],
 ['testing','Software Testing','Test cases and boundary values|Unit versus integration scope','Design boundary tests for a checkout calculation','Tests cover zero, negative, maximum, rounding and invalid inputs'],
 ['design','Design Fundamentals','Hierarchy, contrast and spacing|Typography and interaction states','Design a form with default, focus, loading and error states','Review contrast and explain the hierarchy with 3 concrete design decisions'],
 ['research','User Research','Interview questions and bias|Synthesis and consent','Run 3 consented usability sessions on a prototype using neutral prompts','Record anonymized observations and separate observations from assumptions'],
 ['algorithms','Data Structures','Arrays, maps and queues|Complexity and invariants','Implement a bounded task queue and compare lookup strategies','Tests cover FIFO, overflow and empty behavior; explain time and space complexity'],
 ['api','API Design','Resource modeling and validation|Authentication and pagination','Build an owned paginated notes API using one chosen backend stack','Tests reject foreign ownership and malformed cursors and preserve stable pagination'],
 ['transactions','Database Transactions','Isolation and locking|Atomicity and concurrency','Simulate two concurrent inventory purchases with transactional updates','Prove inventory never goes negative and one conflicting purchase retries or fails safely'],
 ['distributed','Distributed Systems','Retries and deduplication|Consistency and failure boundaries','Build a local retrying event handler with idempotency keys','Inject duplicate and reordered events and prove a single business effect'],
 ['react','React','Component state and effects|Accessible forms and async state','Build a searchable list with loading, empty, error and retry states','Tests verify stale requests cannot replace newer results and keyboard access works'],
 ['frontend-performance','Web Performance','Rendering and code splitting|Network and interaction budgets','Profile a list view and defer an optional heavy panel','Record comparable cold-load bytes and interaction traces before and after'],
 ['full-stack','Full Stack Integration','API schemas and forms|Session boundaries and validation','Connect an accessible form to an owned API using one frontend and backend stack','Integration checks cover session expiry, validation errors and duplicate submissions'],
 ['containers','Docker','Images and layers|Runtime configuration and health checks','Containerize a local HTTP service as a non-root process','Demonstrate healthy startup, graceful shutdown and no embedded credentials'],
 ['cicd','CI/CD','Build reproducibility|Test gates and rollback','Create a local pipeline definition for test, build and staged release','A failing test blocks release and a documented rollback restores the prior artifact'],
 ['cloud','Cloud Fundamentals','Compute, storage and networking|Least privilege and cost boundaries','Draw and validate a minimal private service architecture without deploying it','Map each data flow to a network rule and record a cost assumption and failure mode'],
 ['iac','Infrastructure as Code','Declarative state and drift|Plans and secret handling','Write a small infrastructure module and inspect a plan offline','Validate syntax and explain create, update and destroy effects without applying a plan'],
 ['security','Security Fundamentals','Threat modeling and trust boundaries|Authentication and authorization','Threat-model a sample login and file-upload workflow','Document 5 threats, their controls and residual risk without testing real systems'],
 ['incident','Incident Response','Triage and evidence preservation|Containment and recovery','Run a tabletop exercise for a leaked test credential','Produce a timestamped containment plan, recovery criteria and prevention actions'],
 ['analysis','Data Analysis','Cleaning and aggregation|Charts and interpretation','Analyze a synthetic sales dataset and explain 3 business findings','Reconcile chart totals to source rows and disclose missing-data treatment'],
 ['etl','Data Pipelines','Schema validation and transformations|Incremental loads and replay','Build a replayable local CSV-to-table pipeline','Rerun identical input without duplicates and quarantine invalid rows'],
 ['orchestration','Pipeline Orchestration','Dependencies and checkpoints|Retries and backfills','Schedule a local multi-step pipeline with a failing intermediate step','Resume from a checkpoint and prove completed outputs are not duplicated'],
 ['ml','Machine Learning','Train-validation-test splits|Baselines, metrics and leakage','Compare a simple baseline and classifier on public or synthetic data','Report held-out metrics and prove preprocessing never fits on test data'],
 ['mlops','MLOps','Artifact versioning and validation|Drift and rollback','Package a deterministic local predictor with a versioned schema','Tests reject invalid input and reproduce predictions from the saved artifact'],
 ['database-design','Database Design','Keys and normalization|Indexes and query plans','Design an order schema and inspect an offline or test query plan','Explain key constraints and show how a chosen index changes the plan on test data'],
 ['mobile','Mobile UI','Navigation and state|Lifecycle, accessibility and layout','Build a two-screen app using one chosen mobile framework','Verify back navigation, rotated layout, keyboard access and restored screen state'],
 ['mobile-network','Mobile Networking','Async requests and offline state|Cancellation and retry policy','Add an offline-capable paginated list to a sample mobile app','Simulate disconnect, retry and screen exit without duplicate items or stale updates'],
 ['mobile-production','Mobile Reliability','Crash diagnosis and profiling|Release checks and permissions','Profile a sample app and prepare a reproducible release checklist','Capture a baseline trace and verify permission denial and interrupted startup recovery'],
 ['qa-automation','Test Automation','Selectors and fixtures|Deterministic assertions and isolation','Automate checkout success and validation flows against a local fixture','Run the suite 10 times with isolated state and no timing-based retries'],
 ['qa-strategy','Quality Strategy','Risk-based coverage|Defect triage and release criteria','Write a test strategy for a sample payment feature','Trace each critical risk to a test and define explicit release-blocking criteria'],
 ['architecture','Software Architecture','Boundaries and interfaces|Tradeoffs and change impact','Refactor a small task service behind an explicit storage interface','Contract tests pass for two storage implementations and document one tradeoff'],
 ['design-systems','Design Systems','Reusable components and tokens|Consistency and accessible states','Build a small component library covering buttons, forms and feedback states','Audit 6 components for token consistency, contrast and documented interaction states'],
 ['interaction','Interaction Design','Task flows and feedback|Error prevention and recovery','Prototype a multi-step application flow with undo and validation','In 3 consented sessions, record completion and errors and revise one observed problem']
];
const guides = Object.fromEntries(rows.map(([id,name,topics,exercise,proof]) => [id,{id,name,subtopics:topics.split('|'),exercise,proof}]));
// Edges point to prerequisites. Shared concepts are reused across careers, never copied user data.
const tracks: Record<string, string[][]> = {
 'backend-developer': [['programming','http','sql','git'],['api','transactions'],['distributed']],
 'frontend-developer': [['html','css','javascript','git'],['react'],['frontend-performance']],
 'full-stack-developer': [['programming','html','css','javascript','http','sql'],['api','react'],['full-stack']],
 'devops-engineer': [['linux','networking','git'],['containers','cicd'],['iac']],
 'cloud-engineer': [['linux','networking'],['cloud','containers'],['iac']],
 'cybersecurity-engineer': [['linux','networking'],['security'],['incident']],
 'data-analyst': [['sql','statistics'],['analysis'],['etl']],
 'data-engineer': [['python','sql'],['etl','database-design'],['orchestration']],
 'data-scientist': [['python','statistics'],['analysis','ml'],['mlops']],
 'database-engineer': [['sql'],['database-design','transactions'],['distributed']],
 'machine-learning-engineer': [['python','statistics'],['ml'],['mlops']],
 'mobile-developer': [['programming','http','git'],['mobile','mobile-network'],['mobile-production']],
 'qa-engineer': [['testing','http'],['qa-automation'],['qa-strategy']],
 'software-engineer': [['programming','git','testing'],['algorithms','api'],['architecture']],
 'ui-ux-designer': [['design','research'],['interaction'],['design-systems']]
};
// Explicit role-local edges avoid treating every tool in a role as a compulsory stack.
const edges: Record<string,string[]> = {
 api:['programming','http'],transactions:['sql'],distributed:['transactions'],
 react:['javascript','html','css'],'frontend-performance':['react'],
 'full-stack':['api','react'],containers:['linux'],cicd:['git','containers'],cloud:['networking'],iac:['cloud'],
 security:['networking','linux'],incident:['security'],analysis:['statistics'],etl:['sql'],
 orchestration:['etl'],ml:['python','statistics'],mlops:['ml'],'database-design':['sql'],
 mobile:['programming'],'mobile-network':['mobile','http'],'mobile-production':['mobile-network'],
 'qa-automation':['testing','http'],'qa-strategy':['qa-automation'],algorithms:['programming'],architecture:['algorithms','api'],'design-systems':['interaction'],interaction:['design','research']
};
export const LEARNING_KNOWLEDGE_HASH = createHash('sha256').update(JSON.stringify({version:LEARNING_KNOWLEDGE_VERSION,rows,tracks,edges,supplemental:SUPPLEMENTAL_GUIDANCE_ROWS,supplementalVersion:SUPPLEMENTAL_GUIDANCE_VERSION})).digest('hex');
export const SUPPORTED_LEARNING_ROLES = Object.freeze(Object.keys(tracks));
export function getCareerLearningTopics(slug: string): LearningTopic[] {
    const track = tracks[slug]; if (!track) return [];
    const ids = new Set(track.flat());
    return track.flatMap((group,index) => group.map(id => {
        const item = guides[id];
        // Some disciplines share a technique but require a different prerequisite, e.g. UX measurement.
        let prerequisites = (edges[id] || []).filter(value => ids.has(value));
        if (slug === 'devops-engineer' && id === 'iac') prerequisites = ['containers','cicd'];
        if (slug === 'ui-ux-designer' && id === 'frontend-performance') prerequisites = ['interaction'];
        if (slug === 'data-analyst' && id === 'etl') prerequisites = ['analysis','sql'];
        if (slug === 'data-engineer' && id === 'etl') prerequisites = ['python','sql'];
        return { ...item, subtopics:[...item.subtopics], curated:true, guidanceSource:'reference-pack' as const, prerequisites, level: (['beginner','intermediate','advanced'] as const)[index] };
    }));
}
