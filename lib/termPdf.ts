import { jsPDF } from 'jspdf';
import { TermsSignerData, buildTermsText } from './terms';

// A hospedagem (hPanel) responde em legacy.iteqescolas.com.br: o domínio principal está na Vercel, que não executa PHP.
const UPLOAD_URL = 'https://legacy.iteqescolas.com.br/TERMOS-ASS/upload.php';

const MARGIN = 12; // mm
const LINE_HEIGHT = 4.4; // mm, para fonte tamanho 10
const SIGNATURE_BLOCK = 36; // mm reservados para a assinatura

// Monta o PDF do termo com os dados da pessoa e a assinatura desenhada (data URL em PNG).
// O texto é dividido em quantas páginas forem necessárias (jsPDF não quebra página sozinho).
export const buildTermPdf = (signer: TermsSignerData, signaturePng: string): Blob => {
  const doc = new jsPDF({ compress: true });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(10);

  const lines: string[] = doc.splitTextToSize(buildTermsText(signer), pageWidth - MARGIN * 2);
  const linesPerPage = Math.floor((pageHeight - MARGIN * 2) / LINE_HEIGHT);

  let y = MARGIN;
  lines.forEach((line, index) => {
    if (index > 0 && index % linesPerPage === 0) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y + 3);
    y += LINE_HEIGHT;
  });

  if (y + SIGNATURE_BLOCK > pageHeight - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }
  doc.text('Assinatura:', MARGIN, y + 8);
  doc.addImage(signaturePng, 'PNG', MARGIN, y + 11, 60, 24);
  return doc.output('blob');
};

// Envia o PDF para a pasta TERMOS-ASS da hospedagem. O upload.php libera CORS, então a resposta pode ser lida:
// falha de rede, erro HTTP ou a resposta de requisição inválida impedem a conclusão do primeiro acesso.
export const uploadTermPdf = async (pdf: Blob, fileName: string): Promise<void> => {
  const body = new FormData();
  body.append('file', pdf, fileName);
  let response: Response;
  try {
    response = await fetch(UPLOAD_URL, { method: 'POST', body });
  } catch {
    throw new Error('Não foi possível enviar o termo assinado. Verifique a conexão e tente novamente.');
  }
  const text = (await response.text().catch(() => '')).trim();
  if (!response.ok || /inv[aá]lid/i.test(text)) {
    console.warn('Envio do PDF do termo recusado:', response.status, text);
    throw new Error('O servidor recusou o termo assinado. Tente novamente.');
  }
};
