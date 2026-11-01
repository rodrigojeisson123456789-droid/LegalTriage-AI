"""Genera los Word de apoyo; requiere Pandoc y python-docx, no dependencias de la app."""
import subprocess
from pathlib import Path
from docx import Document
from docx.shared import Inches, Mm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
for name in ['DESCRIPCION_FUNCIONAL','REVISION_OBJETIVOS_Y_PENDIENTES']:
 p=Path(__file__).resolve().parent/(name+'.docx')
 subprocess.run(['pandoc', str(p.with_suffix('.md')), '-o', str(p)], check=True)
 d=Document(p)
 for sec in d.sections:
  sec.page_width=Mm(210);sec.page_height=Mm(297)
  sec.left_margin=Inches(.7);sec.right_margin=Inches(.7)
 for st in d.styles:
  if st.name in ['Normal','Body Text','First Paragraph','Compact']:
   st.font.name='Calibri';st.font.size=Pt(11)
  elif st.name.startswith('Heading'): st.font.color.rgb=RGBColor.from_string('322D24')
 for tab in d.tables:
  pr=tab._tbl.tblPr
  for old in list(pr.findall(qn('w:tblBorders'))): pr.remove(old)
  borders=OxmlElement('w:tblBorders')
  for edge in ['top','left','bottom','right','insideH','insideV']:
   el=OxmlElement('w:'+edge);el.set(qn('w:val'),'single');el.set(qn('w:sz'),'4');el.set(qn('w:color'),'D8D0C0');borders.append(el)
  pr.append(borders)
  headers=[c.text for c in tab.rows[0].cells]
  widths=([.08,.25,.67] if headers[0]=='Código' else [.2,.4,.4] if headers[0]=='Participante' else [.06,.23,.32,.39] if headers[0]=='Orden' else [.27,.34,.39] if headers[0].startswith('Etapa') else [.22,.39,.39] if headers[0]=='Evidencia' else None)
  if widths:
   tab.autofit=False
   avail=d.sections[0].page_width-d.sections[0].left_margin-d.sections[0].right_margin
   for col,width in zip(tab.columns,widths): col.width=int(avail*width)
  for i,row in enumerate(tab.rows):
   prop=row._tr.get_or_add_trPr()
   for tag in ['w:cantSplit','w:tblHeader']:
    for old in list(prop.findall(qn(tag))): prop.remove(old)
   prop.append(OxmlElement('w:cantSplit'))
   if i==0: prop.append(OxmlElement('w:tblHeader'))
   for j,cell in enumerate(row.cells):
    if widths: cell.width=int(avail*widths[j])
    for para in cell.paragraphs:
     para.paragraph_format.space_after=Pt(4)
     for run in para.runs:
      run.font.size=Pt(10)
      if i==0: run.bold=True
 d.save(p)
 print(name, 'tablas:',len(d.tables))
