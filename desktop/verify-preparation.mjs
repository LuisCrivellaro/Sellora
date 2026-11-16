import { expect } from '@playwright/test';
import { preparationResult } from '../src/lib/demos/send-preparation-fixtures.ts';

/** Somente fixtures e HTTP interceptado: não consome IA nem faz deploy. */
export async function verifyAutomaticPreparation(browser, origin) {
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 try {
  const page = await context.newPage();
  const result = preparationResult();
  let configured=false, generations=0, publishes=0, publication=null;
  await page.route('**/api/demos/generator', route=>route.fulfill({json:{claude:{available:true,message:'Conta Claude de teste'},available:true,connected:true,message:'Teste isolado'}}));
  await page.route('**/api/demos/jobs**', route=>{
   if(route.request().method()!=='POST')return route.fulfill({json:{job:null}});
   generations++;
   return route.fulfill({json:{job:{id:route.request().postDataJSON().id,status:'completed',phase:'Pronto',result}}});
  });
  await page.route('**/api/publications',route=>route.fulfill({json:{status:{configured,missing:[],invalid:[],warnings:[],baseDomain:'example.com',repository:'test/demos',sourceMode:'public'}}}));
  await page.route('**/api/publications/**', route=>{
   if(route.request().method()==='POST'){
    publishes++;
    const body=route.request().postDataJSON(), at=new Date().toISOString();
    publication={version:1,id:crypto.randomUUID(),leadId:route.request().url().split('/').at(-1),business:body.business,slug:'demo-teste',status:'published',health:'ok',siteId:body.siteId,publishedSiteId:body.siteId,url:'https://demo.example.com/',domain:'demo.example.com',coolifyAppUuid:'testapp',coolifyAppName:'demo',github:{repo:'test/demos',branch:'main',path:'sites/demo',commitSha:null},createdAt:at,updatedAt:at,lastDeployAt:at,lastCheckedAt:at,lastError:null,operations:[],active:false};
   }
   return route.fulfill({json:{publication}});
  });
  await page.route('**/sites/**', route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Demo de teste</title><body><h1>Demonstração não oficial</h1></body></html>'}));
  await page.goto(`${origin}/leads?aba=demos`);
  await page.waitForFunction(()=>localStorage.getItem('sellora.db.v1'));
  await page.evaluate(()=>{
   const db=JSON.parse(localStorage.getItem('sellora.db.v1'));
   db.leads=db.leads.slice(0,1).map(lead=>({...lead,stage:'novo',demo:null,phone:'(19) 99999-1234',lastContactAt:null}));
   db.activities=[];
   localStorage.setItem('sellora.db.v1',JSON.stringify(db));
   localStorage.removeItem('sellora-demo-generator-v1');
  });
  await page.reload();
  await page.getByRole('list',{name:'Leads disponíveis para demos'}).getByRole('checkbox').first().check();
  await expect(page.getByRole('button',{name:'Adicionar à fila (1)',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Gerar e preparar envio (1)',exact:true}).click();
  const row=page.getByRole('list',{name:'Fila de geração de demos'}).getByRole('listitem').first();
  await expect(row).toContainText('Configure o Coolify');
  if(generations!==1 || publishes!==0)throw new Error('Sem configuração deve preservar a geração, sem publicar');
  configured=true;
  await row.getByRole('button',{name:'Tentar preparar envio',exact:true}).click();
  await expect(row).toContainText('Pronta para envio manual');
  if(generations!==1 || publishes!==1)throw new Error('Retentar preparação não pode regenerar demo nem duplicar deploy');
  for(const notice of await page.getByRole('button',{name:'Dispensar aviso',exact:true}).all())await notice.click();
  await row.getByRole('button',{name:'Abrir demo e mensagem',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('Aprovada por Revisão automática da Sellora (QA)',{exact:false})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Copiar mensagem com demo',exact:true})).toBeVisible();
  const db=await page.evaluate(()=>JSON.parse(localStorage.getItem('sellora.db.v1')));
  if(db.leads[0].lastContactAt || db.activities.some(a=>a.type==='whatsapp'))throw new Error('Preparação não pode registrar envio');
  await page.screenshot({path:'test-results/automatic-preparation-desktop.png',fullPage:true});
  await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('radio',{name:'Aprovadas (1)',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/automatic-preparation-mobile.png',fullPage:true});
  console.log('PASS preparação opcional: demo preservada sem Coolify, retomada sem regenerar, revisão identificada, mensagem disponível, nenhum envio e layout móvel.');
 } finally {await context.close();}
}
