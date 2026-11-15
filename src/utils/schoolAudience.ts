/** Shared by lists and direct-submit endpoints so an ID cannot bypass group scope. */
export function studentAssignmentVisible(user:any,row:any){
 if(user.role!=='student'||user.status!=='active'||row.institutionId!==user.institutionId||row.status==='draft'||!user.classId)return false;
 const classes=row.targetClassIds||[],codes=row.targetClassCodes||[];
 return (classes.length?classes.includes(user.classId):codes.some((code:string)=>code.toLowerCase()===user.classCode?.toLowerCase()))&&(!row.groupIds?.length||row.groupIds.some((id:string)=>user.teachingGroupIds?.includes(id)));
}
