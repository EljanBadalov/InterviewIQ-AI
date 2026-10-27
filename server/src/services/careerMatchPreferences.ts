const words=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/** Apply current explicit preferences to historical candidates without mutating them. */
export function matchesCareerPreferences(job:any, preferences:any):boolean {
    if(!preferences)return true;
    const contains=(list:string[]|undefined,value:string)=>!list?.length || list.includes(value);
    if(!contains(preferences.workModes,job.remoteType)||!contains(preferences.employmentTypes,job.employmentType)||!contains(preferences.experienceLevels,job.experienceLevel))return false;
    return !preferences.locations?.length || preferences.locations.some((location:string)=>words(job.location || '').includes(words(location)));
}
