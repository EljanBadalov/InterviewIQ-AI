export interface CareerSelection { targetRole:string;roleKey:string|null;revision:number }
/** An older mutation response cannot replace the selected career in this account cache. */
export function canApplyCareerSelection(current:CareerSelection|undefined,incoming:CareerSelection):boolean {
    if(!Number.isSafeInteger(incoming.revision)||incoming.revision<0)return false;
    if(!current)return true;
    if(incoming.revision!==current.revision)return incoming.revision>current.revision;
    return (incoming.roleKey||incoming.targetRole)===(current.roleKey||current.targetRole);
}
