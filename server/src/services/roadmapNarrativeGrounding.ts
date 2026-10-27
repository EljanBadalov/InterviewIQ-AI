import type { CareerLearningPlan } from './careerLearningPlanner';
import type { ICareerSkillProfile } from './careerSkillProfileService';
import type { SkillEvidenceState } from './skillEvidenceAssessment';
import { getCanonicalSkillName } from './skillEvidenceIdentity';
export const NARRATIVE_EVIDENCE_POLICY = 'narrative-evidence-v2';
export interface NarrativeSkillFact {name:string;scope:string;state:SkillEvidenceState;proficiency:number|null;claims:string[]}
const canonical=(name:string)=>getCanonicalSkillName(name).trim().toLowerCase();
/** Legacy matching percentages and resume mentions never become assessed proficiency. */
export function narrativeSkillFacts(names:readonly string[],plan?:CareerLearningPlan,profile?:ICareerSkillProfile,includeUnlisted=true):NarrativeSkillFact[] {
    const facts:NarrativeSkillFact[]=[];
    for(const name of [...new Set(names)].sort()) {
        const mentioned=profile?.skills.filter(skill=>canonical(skill.name)===canonical(name))||[];
        const claims=[...new Set(mentioned.flatMap(skill=>skill.sources?.map(String)||[]))].sort();
        const assessed=plan?.nodes.filter(node=>canonical(node.name)===canonical(name))||[];
        if(!includeUnlisted&&!mentioned.length&&!assessed.length)continue;
        if(!assessed.length)facts.push({name,scope:'unverified',state:claims.length?'partial_evidence':'unverified',proficiency:null,claims});
        else for(const node of [...assessed].sort((a,b)=>a.id.localeCompare(b.id)))facts.push({name:node.name,scope:node.level,state:node.state,proficiency:node.state==='verified_proficiency'||node.state==='verified_gap'?node.score:null,claims});
    }
    return facts;
}

// A bounded claim grammar, not a general natural-language entailment engine.
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\u0307/g, '').replace(/[’‘]/g, "'");
const grammar = {
    subject: /\b(?:you|your|yours|siz|sizin)\b|(?:bacarığınız|biliyiniz|təcrübəniz|layihələriniz)/u,
    conditional: /^(?:if|when|once|after|suppose|imagine|hypothetically|for example|əgər|məsələn|təsəvvür)(?:\s|,)/u,
    future: /\byou (?:will|can|could|may|should|must|need to) (?:learn|practice|build|complete|earn|verify|demonstrate|develop|master|become|gain)\b/u,
    proposal: /^(?:build|complete|create|practice|earn|pursue|obtain|prepare|train|develop|learn|gain|assess|test|verify|demonstrate)\b|\b(?:should|can|must|will) be (?:assessed|verified|demonstrated|developed)\b/u,
    possessive: /\byour\b|sizin|bacarığınız|biliyiniz|təcrübəniz|layihələriniz/u,
    presupposition: /\b(?:already|your (?:verified|proven|certified|completed)|have (?:mastered|earned|completed|built))\b|\byour\b.{0,100}\b(?:verified|proven|certified|completed|expertise|mastery|advanced|expert|is|are|has)\b|artıq/u,
    negated: /\b(?:unverified|unassessed|unknown|not (?:yet )?(?:verified|proven|certified|proficient|assessed))\b|təsdiqlənməyib|yoxlanılmayıb|məlum deyil/u,
    doubleNegative: /\bnot (?:unverified|unassessed|unknown)\b/u,
    credential: /\b(?:certified|certification|certificate|credential)\b|sertifikat|sertifikasiy/u,
    history: /\b(?:years? of|professional experience|experienced|worked|employment|completed|finished|built|delivered|shipped|earned|graduated|published)\b|təcrübə|tamamlamıs|tamamlamış|qurmus|qurmuş|işləmis|işləmiş|qazanmış/u,
    ability: /\b(?:proficiency|proficient|mastery|mastered|expert|expertise|advanced|senior|verified|proven|assessed|demonstrated|validated|confirmed|established|competence|competent|knowledge|skilled|fluent|qualified|know|skill score)\b|mənimsəmis|mənimsəmiş|ustalıq|ekspert|yüksək səviyy|təsdiqlən|sübut olun/u,
    assertion: /\b(?:are|is|have|has|possess|hold|bring|know|worked|completed|built|earned|already)\b|\byour\s+(?:verified|proven|advanced|expert|completed|certified)\b|artıq|siniz|sınız|sübut olunub|təsdiqlənib/u,
    gap: /\b(?:lack|lacking|weakness|deficient|verified gap|poor proficiency|not mastered|never mastered)\b|çatışmazlıq|zəif/u,
};
const scopeTerms: ReadonlyArray<readonly [string, RegExp]> = [
    ['beginner', /\b(?:beginner|basic|foundational)\b|başlanğıc|təməl/u],
    ['intermediate', /\bintermediate\b|orta səviyy/u],
    ['advanced', /\b(?:advanced|expert|senior)\b|ekspert|yüksək səviyy/u],
];
const validFacts = (facts: readonly NarrativeSkillFact[]) => facts.length <= 128 && facts.every(fact => fact.name.length <= 160 && fact.scope.length <= 40);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
interface FactGroup { names: RegExp[]; facts: NarrativeSkillFact[] }
function indexFacts(facts: readonly NarrativeSkillFact[]): FactGroup[] {
    const groups = new Map<string, NarrativeSkillFact[]>();
    for (const fact of facts) {
        const key = canonical(fact.name);
        groups.set(key, [...(groups.get(key) || []), fact]);
    }
    return [...groups].map(([name, rows]) => ({
        names: [...new Set([name, ...rows.map(row => normalize(row.name))])].map(value => new RegExp(`(?<![\\p{L}\\p{N}])${escape(value)}(?![\\p{L}\\p{N}])`, 'u')),
        facts: rows,
    }));
}
function groundedField(text: string, groups: FactGroup[]): boolean {
    if (text.length > 1800) return false;
    const clauses = normalize(text).split(/[!?;]|\.(?=\s|$)|\b(?:but|however|whereas|because|since|amma|lakin|çünki)\b|\b(?:and|or|və)(?=\s+(?:you|your|siz|sizin)\b)/u).map(value => value.trim()).filter(Boolean);
    if (clauses.length > 24) return false;
    for (const clause of clauses) {
        if (!grammar.subject.test(clause) || grammar.conditional.test(clause)) continue;
        if (grammar.doubleNegative.test(clause)) return false;
        if ((grammar.future.test(clause) || grammar.proposal.test(clause)) && !grammar.presupposition.test(clause) && !/\byou (?:have|are)\b/u.test(clause)) continue;
        const numeric = [...clause.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|percent\b|faiz(?:dir|lik)?\b)/gu)].map(match => Number(match[1]));
        const score = /(?:proficiency|mastery|skill score)\s+(?:is|at|=)\s*(\d+(?:\.\d+)?)/u.exec(clause);
        if (score && !numeric.includes(Number(score[1]))) numeric.push(Number(score[1]));
        if (grammar.negated.test(clause) && !numeric.length) continue;
        const history = grammar.history.test(clause), credential = grammar.credential.test(clause);
        const gap = grammar.gap.test(clause), ability = grammar.ability.test(clause);
        if (!numeric.length && !gap && !((grammar.assertion.test(clause) || grammar.possessive.test(clause) || /\bcertified\b/u.test(clause)) && (history || credential || ability))) continue;
        // Assessment evidence does not attest certificates, employment or finished projects.
        if (history || credential) return false;
        const referenced = groups.filter(group => group.names.some(name => name.test(clause)));
        if (!referenced.length) return false; // Broad career-wide mastery has no scoped assessment.
        const scopes = scopeTerms.filter(([, expression]) => expression.test(clause)).map(([scope]) => scope);
        if (scopes.length > 1) return false;
        const strong = /\b(?:mastered|mastery|expert)\b|mənimsəmis|mənimsəmiş|ustalıq|ekspert/u.test(clause);
        for (const group of referenced) {
            const eligible = group.facts.filter(fact => scopes.length ? fact.scope === scopes[0] : strong ? fact.scope === 'advanced' : new Set(group.facts.map(item => item.scope)).size === 1);
            if (numeric.length) {
                if (!numeric.every(value => eligible.some(fact => ['verified_proficiency', 'verified_gap'].includes(fact.state) && fact.proficiency === value))) return false;
            } else if (!eligible.some(fact => fact.state === (gap ? 'verified_gap' : 'verified_proficiency'))) return false;
        }
    }
    return true;
}
/** All generative fields share the same evidence boundary; no additional inference. */
export function narrativeTextGrounded(text: {whyItMatters: string; action: string; proofOfCompletion: string}, facts: readonly NarrativeSkillFact[]): boolean {
    if (!validFacts(facts)) return false;
    const groups = indexFacts(facts);
    return [text.whyItMatters, text.action, text.proofOfCompletion].every(field => groundedField(field, groups));
}
/** Kept for callers that validate a single explanation. */
export function narrativeGrounded(text: string, facts: readonly NarrativeSkillFact[]): boolean {
    return validFacts(facts) && groundedField(text, indexFacts(facts));
}
