Created At: 2026-10-31T17:02:09+05:30
Completed At: 2026-10-31T17:02:09+05:30
Showing lines 1100-1248 of 1248
1100:                 <col className="w-[30%] sm:w-[28%]" /> {/* Project & ID */}
1101:                 <col className="w-[18%] sm:w-[17%]" /> {/* Client */}
1102:                 <col className="w-[12%] sm:w-[12%]" /> {/* Due Date */}
1103:                 <col className="w-[11%] sm:w-[11%]" /> {/* Stage Progress */}
1104:                 <col className="w-[12%] sm:w-[12%]" /> {/* Status */}
1105:                 <col className="w-[13%] sm:w-[14%]" /> {/* Budget */}
1106:                 <col className="w-16" />               {/* Actions */}
1107:               </colgroup>
1108:               <thead>
1109:                 <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
1110:                   <th className="py-2.5 pl-4 pr-2">Project & ID</th>
1111:                   <th className="py-2.5 px-2">Client</th>
1112:                   <th className="py-2.5 px-2">Due Date</th>
1113:                   <th className="py-2.5 px-2">Stage Progress</th>
1114:                   <th className="py-2.5 px-2">Status</th>
1115:                   <th className="py-2.5 px-2">Budget</th>
1116:                   <th className="py-2.5 pl-2 pr-4 text-right">Actions</th>
1117:                 </tr>
1118:               </thead>
1119:               <tbody className="divide-y divide-border text-xs">
1120:                 {filteredProjects.map((project, idx) => {
1121:                   const stages = project.stages || [];
1122:                   const totalStages = stages.length;
1123:                   const completedCount = stages.filter(
1124:                     (s) => (s.status || '').toLowerCase() === 'done' || (s.status || '').toLowerCase() === 'completed'
1125:                   ).length;
1126:                   const progressPercent = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : (project.status === 'completed' ? 100 : 0);
1127:                   const overdue = isProjectOverdue(project);
1128:                   const clientDisplayName = getClientDisplayName(project, clients);
1129: 
1130:                   return (
1131:                     <tr
1132:                       key={project.id}
1133:                       onClick={() => navigate(`/projects/${project.id}`)}
1134:                       className="hover:bg-muted/30 cursor-pointer transition-colors"
1135:                     >
1136:                       <td className="py-2.5 pl-4 pr-2 font-semibold text-foreground">
1137:                         <div className="flex items-center gap-2">
1138:                           <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border shrink-0">
1139:                             #{idx + 1}
1140:                           </span>
1141:                           <span className="font-bold text-foreground hover:text-primary transition-colors line-clamp-1">
1142:                             {project.name}
1143:                           </span>
1144:                         </div>
1145:                       </td>
1146:                       <td className="py-2.5 px-2 text-muted-foreground">
1147:                         <span className="font-medium text-foreground truncate block max-w-[170px]" title={clientDisplayName}>
1148:                           {clientDisplayName}
1149:                         </span>
1150:                       </td>
1151:                       <td className="py-2.5 px-2 font-mono whitespace-nowrap">
1152:                         <span className={cn(overdue ? 'text-destructive font-bold' : 'text-foreground')}>
1153:                           {project.endDate || project.dueDate ? formatDate(project.endDate || project.dueDate) : '-'}
1154:                         </span>
1155:                       </td>
1156:                       <td className="py-2.5 px-2 font-mono font-bold text-xs text-foreground whitespace-nowrap">
1157:                         {progressPercent}%
1158:                       </td>
1159:                       <td className="py-2.5 px-2 whitespace-nowrap">
1160:                         <Badge
1161:                           variant={
1162:                             project.status === 'completed'
1163:                               ? 'success'
1164:                               : project.status === 'planning'
1165:                               ? 'neutral'
1166:                               : 'primary'
1167:                           }
1168:                           size="sm"
1169:                           dot
1170:                         >
1171:                           {(project.status || 'in progress').toUpperCase()}
1172:                         </Badge>
1173:                       </td>
1174:                       <td className="py-2.5 px-2 font-mono font-semibold text-foreground whitespace-nowrap">
1175:                         {project.totalCost ? formatCurrency(project.totalCost) : '-'}
1176:                       </td>
1177:                       <td className="py-2.5 pl-2 pr-4 text-right">
1178:                         <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
1179:                           <button
1180:                             type="button"
1181:                             title="View"
1182:                             aria-label="View"
1183:                             onClick={() => navigate(`/projects/${project.id}`)}
1184:                             className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
1185:                           >
1186:                             <EyeIcon className="size-3.5" />
1187:                           </button>
1188:                           {isManagerOrAdmin && (
1189:                             <button
1190:                               type="button"
1191:                               title="Schedules"
1192:                               aria-label="Schedules"
1193:                               onClick={() => handleOpenScheduleModal(project)}
1194:                               className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
1195:                             >
1196:                               <CalendarIcon className="size-3.5" />
1197:                             </button>
1198:                           )}
1199:                           {isManagerOrAdmin && (
1200:                             <button
1201:                               type="button"
1202:                               title="Delete"
1203:                               aria-label="Delete"
1204:                               onClick={() => setDeleteProjectConfirm(project)}
1205:                               className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
1206:                             >
1207:                               <TrashIcon className="size-3.5" />
1208:                             </button>
1209:                           )}
1210:                         </div>
1211:                       </td>
1212:                     </tr>
1213:                   );
1214:                 })}
1215:               </tbody>
1216:             </table>
1217:           </div>
1218:         </div>
1219:       )}
1220: 
1221:       {/* Manager Assign / Edit Stage Dates Modal */}
1222:       <ScheduleStageModal
1223:         isOpen={Boolean(editingStageData)}
1224:         onClose={() => setEditingStageData(null)}
1225:         data={editingStageData}
1226:         onSave={handleSaveStageSchedule}
1227:       />
1228: 
1229:       {/* Quick Edit Project Modal */}
1230:       <QuickEditProjectModal
1231:         isOpen={Boolean(editingProject)}
1232:         onClose={() => setEditingProject(null)}
1233:         project={editingProject}
1234:         onSave={handleSaveProjectDetails}
1235:       />
1236: 
1237:       {/* Confirm Delete Project Modal */}
1238:       <ConfirmDeleteProjectModal
1239:         isOpen={Boolean(deleteProjectConfirm)}
1240:         onClose={() => setDeleteProjectConfirm(null)}
1241:         data={deleteProjectConfirm}
1242:         onConfirm={handleConfirmDelete}
1243:       />
1244:     </div>
1245:   );
1246: }
1247: 
1248: export default ProjectsPage;