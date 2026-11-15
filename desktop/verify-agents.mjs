import { expect } from '@playwright/test';
export async function verifyIndependentAgents(browser, origin) {
const context = await browser.newContext({viewport:{width:1440,height:1000}});
try {
 const page = await context.newPage();
 let polls=0, demoPosts=0, prospectDeletes=0;
 const job={id:crypto.randomUUID(),executor:'osm',params:{city:'Campinas',uf:'SP',segment:'beleza',radiusKm:10,maxResults:10,opportunity:'todas'},status:'running',phase:'analyzing',message:'Pesquisa independente em andamento',candidates:5,analyzed:2,planned:5,found:0,warnings:[],error:null,startedAt:new Date().toISOString(),finishedAt:null,results:null,attribution:'Teste isolado'};
 await page.route('**/api/prospeccao/status',route=>route.fulfill({json:{configured:true,executor:'osm',label:'Teste isolado',instructions:[],limits:{maxResults:10,maxRadiusKm:50,jobsPerHour:10}}}));
 await page.route('**/api/prospeccao/jobs**',route=>{if(route.request().method()==='DELETE'){prospectDeletes++;return route.fulfill({json:{job:{...job,status:'cancelled'}}});}if(route.request().method()==='GET')polls++;return route.fulfill({json:{job}});});
 await page.route('**/api/demos/generator',route=>route.fulfill({json:{available:true,connected:true,claude:{available:true,message:'Teste isolado'},imageGeneration:true,message:'Teste isolado'}}));
 await page.route('**/api/demos/jobs**',route=>{if(route.request().method()==='POST'){demoPosts++;const body=route.request().postDataJSON();return route.fulfill({json:{job:{id:body.id,status:'failed',phase:'Fim controlado',error:'Teste isolado',result:null}}});}return route.fulfill({json:{job:null}});});
 await page.goto(`${origin}/leads?aba=prospeccao`);
 await page.getByLabel('Cidade',{exact:true}).fill('Campinas');
 await page.getByRole('button',{name:'Buscar os 10 melhores leads',exact:true}).click();
 await expect(page.getByText('Pesquisa independente em andamento',{exact:true})).toBeVisible();
 await page.getByRole('radio',{name:'Geração de Demos',exact:true}).click();
 const before=polls;
 await expect.poll(()=>polls).toBeGreaterThan(before);
 await expect(page.getByRole('heading',{name:'Agente Gerador de Demos'})).toBeVisible();
 const names=await page.getByRole('list',{name:'Leads disponíveis para demos'}).getByRole('checkbox').count();
 if(names<2)throw new Error('Esperava dois leads de demonstração');
 await page.getByRole('list',{name:'Leads disponíveis para demos'}).getByRole('checkbox').nth(0).check();
 await page.getByRole('list',{name:'Leads disponíveis para demos'}).getByRole('checkbox').nth(1).check();
 await page.getByRole('button',{name:'Adicionar à fila (2)',exact:true}).click();
 const queue=page.getByRole('list',{name:'Fila de geração de demos'});
 await expect(queue.getByRole('listitem')).toHaveCount(2);
 if(demoPosts!==0)throw new Error('Modo manual iniciou IA');
 await queue.getByRole('button',{name:'Cancelar esta demo',exact:true}).first().click();
 await expect(queue.getByText('Cancelada',{exact:false}).first()).toBeVisible();
 await queue.getByRole('button',{name:'Iniciar / retomar',exact:true}).click();
 await expect.poll(()=>demoPosts).toBe(1);
 if(prospectDeletes!==0)throw new Error('Demo cancelou pesquisa');
 await page.getByRole('radio',{name:'Prospecção',exact:true}).click();
 await expect(page.getByText('Pesquisa independente em andamento',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancelar pesquisa',exact:true}).click();
 await expect.poll(()=>prospectDeletes).toBe(1);
 await page.route('**/api/agents/agents',route=>route.fulfill({json:{agents:[
  {id:'prospeccao',name:'Agente de Prospecção',role:'Busca e qualifica leads',status:'running',currentRun:{business:'Campinas',task:'Analisando estabelecimentos'},lastRun:null},
  {id:'gerador-de-demos',name:'Agente Gerador de Demos',role:'Cria sites para os leads selecionados',status:'paused',currentRun:null,lastRun:{business:'Clínica',task:'Geração pausada'}},
  {id:'coolify-deploy',name:'Publicação',role:'Publica demos',status:'idle',currentRun:null,lastRun:null},
  {id:'revisor-de-demos',name:'Revisor de Demos',role:'Acompanha o QA real',status:'waiting_approval',currentRun:null,lastRun:{business:'Clínica',task:'QA com pendências; aguarda aprovação',review:{status:'needs_review',issues:['Título cortado no celular']}}}
 ]}}));
 await page.goto(`${origin}/dashboard/cloud-3d`);
 const prospectCard=page.getByRole('article',{name:'Agente de Prospecção',exact:true});
 const demoCard=page.getByRole('article',{name:'Agente Gerador de Demos',exact:true});
 await expect(prospectCard.getByText('Analisando estabelecimentos',{exact:false})).toBeVisible();
 await expect(demoCard.getByText('Geração pausada',{exact:false})).toBeVisible();
 await expect(page.getByRole('article',{name:'Revisor de Demos',exact:true}).getByText('Título cortado no celular')).toBeVisible();
 await prospectCard.getByRole('button',{name:'Abrir Prospecção',exact:true}).click();
 await expect(page).toHaveURL(/aba=prospeccao/);
 await page.goto(`${origin}/dashboard/cloud-3d`);
 await page.getByRole('button',{name:'Abrir Geração de Demos',exact:true}).click();
 await expect(page).toHaveURL(/aba=demos/);
 await page.goto(`${origin}/dashboard/cloud-3d`);
 await page.getByRole('button',{name:'Abrir Revisão de Demos',exact:true}).click();
 await expect(page).toHaveURL(/aba=demos/);
 await page.getByRole('radio',{name:'Geração de Demos',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Agente Gerador de Demos'})).toBeVisible();
 await page.screenshot({path:'test-results/independent-agents-ui.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('heading',{name:'Agente Gerador de Demos'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 console.log('PASS: pesquisa acompanha troca de área, dois leads entram sem IA, cancelamento individual preserva outra demo e pesquisa, controle independente e layout móvel.');
} finally {await context.close();}
}
