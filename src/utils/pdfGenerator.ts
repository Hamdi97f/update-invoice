import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Facture, Devis, BonLivraison, CommandeFournisseur } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from './currency';
import { getCompanyInfo } from './numberGenerator';
import { numberToWords } from './numberToWords';
import { getCurrencySymbol, getCurrencyDecimals } from './currency';

const formatDate = (date: Date) => format(date, 'dd/MM/yyyy', { locale: fr });

// Load template settings with enhanced configuration
const getTemplateSettings = async (isElectron: boolean, query?: any) => {
  const defaultSettings = {
    margins: { top: 10, bottom: 10, left: 10, right: 10 },
    logo: { enabled: false, position: 'right', size: 15, width: 22, url: '' },
    title: { fontSize: 18, color: '#2563eb', fontWeight: 'bold', position: 'center', marginBottom: 8 },
    table: { fontSize: 8, headerFontSize: 9, cellPadding: 2, borderWidth: 0.3, model: 'simple' },
    footer: { enabled: true, text: 'Merci pour votre confiance', fontSize: 8, color: '#6b7280', fontWeight: 'normal', position: 'left', showDate: true, customText: '' },
    amountInWords: { enabled: false, position: 'left', fontSize: 8, color: '#000000' },
    titlePosition: 'body',
    colors: { primary: '#2563eb', text: '#000000', light: '#f8fafc', border: '#e2e8f0' },
    fonts: { 
      title: { size: 18, weight: 'bold', color: '#2563eb' },
      heading: { size: 11, weight: 'bold', color: '#000000' },
      body: { size: 9, weight: 'normal', color: '#000000' },
      small: { size: 7, weight: 'normal', color: '#6b7280' },
      footer: { size: 8, weight: 'normal', color: '#6b7280' }
    },
    spacing: { section: 8, line: 4, element: 6 }
  };

  try {
    if (isElectron && query) {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['templateSettings']);
      if (result.length > 0) {
        const savedSettings = JSON.parse(result[0].value);
        return { ...defaultSettings, ...savedSettings };
      }
    }
  } catch (error) {
    console.error('Error loading template settings:', error);
  }

  return defaultSettings;
};

// Load logo
const getTemplateLogo = async (isElectron: boolean, query?: any) => {
  try {
    if (isElectron && query) {
      const result = await query('SELECT value FROM settings WHERE key = ?', ['templateLogo']);
      if (result.length > 0) {
        return result[0].value;
      }
    }
  } catch (error) {
    console.error('Error loading template logo:', error);
  }
  return null;
};

// Convert hex to RGB
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

// Enhanced header with customizable logo positioning and sizing
const renderEnhancedHeader = (doc: jsPDF, settings: any, companyInfo: any, logoUrl?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = settings.margins.top;
  
  // Company information positioning
  const companyX = settings.logo.enabled && settings.logo.position === 'left' ? 
    settings.margins.left + (settings.logo.width || 22) + 10 : settings.margins.left;
  
  // Company information
  doc.setFontSize(settings.fonts.heading.size);
  doc.setTextColor(...hexToRgb(settings.fonts.heading.color));
  doc.setFont('helvetica', settings.fonts.heading.weight);
  
  doc.text(companyInfo.nom, companyX, currentY);
  currentY += settings.spacing.line;
  
  // Company details
  doc.setFont('helvetica', settings.fonts.body.weight);
  doc.setFontSize(settings.fonts.body.size);
  doc.setTextColor(...hexToRgb(settings.fonts.body.color));
  
  const companyLines = [
    companyInfo.adresse,
    `${companyInfo.codePostal} ${companyInfo.ville}`,
    `Tél: ${companyInfo.telephone} | Email: ${companyInfo.email}`,
    companyInfo.matriculeFiscal ? `Matricule Fiscal: ${companyInfo.matriculeFiscal}` : '',
    companyInfo.tva ? `TVA: ${companyInfo.tva}` : ''
  ].filter(line => line.trim());
  
  companyLines.forEach(line => {
    doc.text(line, companyX, currentY);
    currentY += settings.spacing.line;
  });
  
  // Logo with customizable size and position
  if (settings.logo.enabled && logoUrl) {
    const logoHeight = settings.logo.size;
    const logoWidth = settings.logo.width || (logoHeight * 1.5);
    
    let logoX: number;
    switch (settings.logo.position) {
      case 'left':
        logoX = settings.margins.left;
        break;
      case 'center':
        logoX = (pageWidth - logoWidth) / 2;
        break;
      case 'right':
      default:
        logoX = pageWidth - settings.margins.right - logoWidth;
        break;
    }
    
    const logoY = settings.margins.top;
    
    try {
      doc.addImage(logoUrl, 'JPEG', logoX, logoY, logoWidth, logoHeight);
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
    }
  }
  
  return Math.max(currentY, settings.margins.top + (settings.logo.enabled ? settings.logo.size : 0)) + settings.spacing.section;
};

// Enhanced title with customizable styling
const renderEnhancedTitle = (doc: jsPDF, settings: any, documentTitle: string, documentData: any, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = startY;
  
  // Document title with custom styling
  doc.setFontSize(settings.title.fontSize);
  doc.setTextColor(...hexToRgb(settings.title.color));
  doc.setFont('helvetica', settings.title.fontWeight);
  
  const titleWidth = doc.getTextWidth(documentTitle);
  let titleX: number;
  
  switch (settings.title.position) {
    case 'left':
      titleX = settings.margins.left;
      break;
    case 'right':
      titleX = pageWidth - settings.margins.right - titleWidth;
      break;
    case 'center':
    default:
      titleX = (pageWidth - titleWidth) / 2;
      break;
  }
  
  doc.text(documentTitle, titleX, currentY);
  currentY += settings.title.marginBottom;
  
  // Horizontal line under title
  doc.setDrawColor(...hexToRgb(settings.colors.border));
  doc.setLineWidth(0.5);
  doc.line(settings.margins.left, currentY, pageWidth - settings.margins.right, currentY);
  
  currentY += settings.spacing.section;
  
  // Document details - right aligned
  const rightX = pageWidth - settings.margins.right;
  
  doc.setFontSize(settings.fonts.body.size);
  doc.setTextColor(...hexToRgb(settings.fonts.body.color));
  doc.setFont('helvetica', 'bold');
  
  doc.text(`N° ${documentData.numero}`, rightX, currentY, { align: 'right' });
  currentY += settings.spacing.line;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(documentData.date)}`, rightX, currentY, { align: 'right' });
  currentY += settings.spacing.line;
  
  // Additional date based on document type
  if (documentData.type === 'facture') {
    doc.text(`Échéance: ${formatDate(documentData.dateEcheance)}`, rightX, currentY, { align: 'right' });
  } else if (documentData.type === 'devis') {
    doc.text(`Validité: ${formatDate(documentData.dateValidite)}`, rightX, currentY, { align: 'right' });
  } else if (documentData.type === 'commande') {
    doc.text(`Réception: ${formatDate(documentData.dateReception)}`, rightX, currentY, { align: 'right' });
  }
  
  return currentY + settings.spacing.section;
};

// Client section
const renderClientSection = (doc: jsPDF, settings: any, documentData: any, startY: number) => {
  let currentY = startY;
  
  // Client label
  doc.setFontSize(settings.fonts.heading.size);
  doc.setTextColor(...hexToRgb(settings.colors.primary));
  doc.setFont('helvetica', 'bold');
  
  const clientLabel = documentData.type === 'commande' ? 'FOURNISSEUR' : 
                     documentData.type === 'bonLivraison' ? 'DESTINATAIRE' : 'CLIENT';
  doc.text(clientLabel, settings.margins.left, currentY);
  currentY += settings.spacing.element;
  
  // Client details
  doc.setFontSize(settings.fonts.body.size);
  doc.setTextColor(...hexToRgb(settings.fonts.body.color));
  
  const clientEntity = documentData.type === 'commande' ? documentData.fournisseur : documentData.client;
  
  // Client name in bold
  doc.setFont('helvetica', 'bold');
  doc.text(clientEntity.nom, settings.margins.left, currentY);
  currentY += settings.spacing.line;
  
  // Client details in normal weight
  doc.setFont('helvetica', 'normal');
  const clientLines = [
    documentData.type !== 'commande' && clientEntity.code ? `Code: ${clientEntity.code}` : '',
    clientEntity.matriculeFiscal ? `Matricule Fiscal: ${clientEntity.matriculeFiscal}` : '',
    clientEntity.adresse,
    `${clientEntity.codePostal} ${clientEntity.ville}`,
    clientEntity.telephone ? `Tél: ${clientEntity.telephone}` : ''
  ].filter(line => line.trim());
  
  clientLines.forEach(line => {
    if (line) {
      doc.text(line, settings.margins.left, currentY);
      currentY += settings.spacing.line;
    }
  });
  
  return currentY + settings.spacing.section;
};

// Enhanced table with optimized width distribution and centering
const renderEnhancedTable = (doc: jsPDF, settings: any, documentData: any, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - settings.margins.left - settings.margins.right;
  
  // Use the same table format for all document types
  const tableHeaders = ['Réf', 'Désignation', 'Qté', 'Prix U.', 'Remise', 'Total HT', 'TVA', 'Total TTC'];
  
  // Ensure lignes is an array and has items
  const validLines = Array.isArray(documentData.lignes) ? documentData.lignes.filter((ligne: any) => 
    ligne && 
    ligne.produit && 
    typeof ligne.quantite === 'number'
  ) : [];
  
  let tableData;
  
  if (documentData.type === 'bonLivraison') {
    // For bon de livraison, create a table with all columns but fill only some
    tableData = validLines.map((ligne: any) => [
      ligne.produit.ref || '-',
      ligne.produit.nom,
      ligne.quantite.toString(),
      formatCurrency(ligne.produit.prixUnitaire),
      '0%',
      formatCurrency(ligne.produit.prixUnitaire * ligne.quantite),
      `${ligne.produit.tva}%`,
      formatCurrency(ligne.produit.prixUnitaire * ligne.quantite * (1 + ligne.produit.tva / 100))
    ]);
  } else {
    // For other document types
    tableData = validLines.map((ligne: any) => [
      ligne.produit.ref || '-',
      ligne.produit.nom,
      ligne.quantite.toString(),
      formatCurrency(ligne.prixUnitaire),
      `${ligne.remise || 0}%`,
      formatCurrency(ligne.montantHT),
      `${ligne.produit.tva}%`,
      formatCurrency(ligne.montantTTC)
    ]);
  }
  
  // Optimized column widths for full table (8 columns) - using percentage of available width
  const columnStyles = {
    0: { cellWidth: availableWidth * 0.10, halign: 'left' },    // Réf: 10%
    1: { cellWidth: availableWidth * 0.30, halign: 'left' },    // Désignation: 30%
    2: { cellWidth: availableWidth * 0.08, halign: 'center' },  // Qté: 8%
    3: { cellWidth: availableWidth * 0.13, halign: 'right' },   // Prix U.: 13%
    4: { cellWidth: availableWidth * 0.09, halign: 'center' },  // Remise: 9%
    5: { cellWidth: availableWidth * 0.13, halign: 'right' },   // Total HT: 13%
    6: { cellWidth: availableWidth * 0.07, halign: 'center' },  // TVA: 7%
    7: { cellWidth: availableWidth * 0.13, halign: 'right' }    // Total TTC: 13%
  };
  
  // Add a default empty row if no data
  if (!tableData || tableData.length === 0) {
    tableData = [['-', 'Aucun produit', '0', '0.000 TND', '0%', '0.000 TND', '0%', '0.000 TND']];
  }
  
  // Table theme based on settings
  let tableTheme: 'plain' | 'striped' | 'grid' = 'plain';
  if (settings.table.model === 'bordered') {
    tableTheme = 'grid';
  } else if (settings.table.model === 'minimal') {
    tableTheme = 'striped';
  }
  
  autoTable(doc, {
    startY: startY,
    head: [tableHeaders],
    body: tableData,
    theme: tableTheme,
    
    // Center the table and use full available width
    margin: { 
      top: 0, 
      bottom: 0, 
      left: settings.margins.left, 
      right: settings.margins.right 
    },
    tableWidth: 'wrap', // Use available width efficiently
    
    headStyles: {
      fillColor: settings.table.model === 'simple' ? hexToRgb('#f8fafc') : hexToRgb(settings.colors.primary),
      textColor: settings.table.model === 'simple' ? hexToRgb(settings.colors.text) : [255, 255, 255],
      fontSize: settings.table.headerFontSize,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 }, // Compact padding
      lineColor: hexToRgb('#d1d5db'),
      lineWidth: 0.2 // Very thin borders
    },
    
    bodyStyles: {
      fontSize: settings.table.fontSize,
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, // Compact padding
      valign: 'middle',
      lineColor: hexToRgb('#d1d5db'),
      lineWidth: 0.2, // Very thin borders
      textColor: hexToRgb(settings.colors.text),
      minCellHeight: 6 // Minimum row height for compactness
    },
    
    columnStyles,
    
    tableLineColor: hexToRgb('#d1d5db'),
    tableLineWidth: 0.2, // Very thin outer borders
    
    alternateRowStyles: settings.table.model !== 'simple' ? {
      fillColor: hexToRgb('#fafafa')
    } : undefined,
    
    styles: {
      lineColor: hexToRgb('#d1d5db'),
      lineWidth: 0.2, // Very thin borders
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }, // Compact padding
      overflow: 'linebreak',
      cellWidth: 'wrap'
    },
    
    showHead: 'everyPage',
    showFoot: 'never',
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    
    // Ensure table uses full width and is centered
    didParseCell: function (data) {
      // Ensure text wrapping for long content
      if (data.column.index === 1) { // Désignation column
        data.cell.styles.cellWidth = columnStyles[1].cellWidth;
      }
    }
  });
  
  // Return the exact final Y position without any additional spacing
  return (doc as any).lastAutoTable.finalY;
};

// Enhanced totals section
const renderEnhancedTotalsSection = (doc: jsPDF, settings: any, documentData: any, startY: number) => {
  // Don't skip totals section for bon de livraison anymore
  
  const pageWidth = doc.internal.pageSize.getWidth();
  // CRITICAL: Use minimal spacing after table - start immediately after table
  let currentY = startY + 5; // Reduced from settings.spacing.section to just 5mm
  
  // Amount in words (if enabled)
  if (settings.amountInWords.enabled) {
    const amountInWords = numberToWords(documentData.totalTTC, getCurrencySymbol());
    doc.setFontSize(settings.amountInWords.fontSize);
    doc.setTextColor(...hexToRgb(settings.amountInWords.color));
    doc.setFont('helvetica', 'bold');
    
    const amountText = `Arrêté la présente ${documentData.type === 'facture' ? 'facture' : 'document'} à la somme de : ${amountInWords}`;
    const maxWidth = pageWidth - settings.margins.left - settings.margins.right - 90;
    
    let amountX = settings.margins.left;
    if (settings.amountInWords.position === 'right') {
      amountX = pageWidth - settings.margins.right - 90;
    }
    
    const splitAmount = doc.splitTextToSize(amountText, maxWidth);
    doc.text(splitAmount, amountX, currentY);
    
    currentY += splitAmount.length * (settings.amountInWords.fontSize * 0.35) + settings.spacing.element;
  }
  
  // Clean totals - right aligned
  const rightX = pageWidth - settings.margins.right;
  
  doc.setFontSize(settings.fonts.body.size);
  doc.setTextColor(...hexToRgb(settings.fonts.body.color));
  doc.setFont('helvetica', 'normal');
  
  // Total HT
  doc.text(`Total HT:`, rightX - 50, currentY);
  doc.text(formatCurrency(documentData.totalHT), rightX, currentY, { align: 'right' });
  currentY += settings.spacing.line;
  
  // Only show taxes from settings, not default TVA
  if (documentData.taxes && documentData.taxes.length > 0) {
    documentData.taxes.forEach((tax: any) => {
      doc.text(`${tax.nom}:`, rightX - 50, currentY);
      doc.text(formatCurrency(tax.montant), rightX, currentY, { align: 'right' });
      currentY += settings.spacing.line;
    });
  }
  
  // Total TTC - emphasized
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(settings.fonts.heading.size);
  doc.setTextColor(...hexToRgb(settings.colors.primary));
  
  doc.text(`Total TTC:`, rightX - 50, currentY);
  doc.text(formatCurrency(documentData.totalTTC), rightX, currentY, { align: 'right' });
  
  return currentY + settings.spacing.section;
};

// Enhanced footer with customizable styling
const renderEnhancedFooter = (doc: jsPDF, settings: any, notes?: string) => {
  if (!settings.footer.enabled) return;
  
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let footerY = pageHeight - settings.margins.bottom - 15;
  
  // Notes if provided
  if (notes && notes.trim()) {
    footerY -= 15;
    
    doc.setFontSize(settings.fonts.body.size);
    doc.setTextColor(...hexToRgb(settings.fonts.body.color));
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', settings.margins.left, footerY);
    
    doc.setFont('helvetica', 'normal');
    const maxWidth = pageWidth - settings.margins.left - settings.margins.right;
    const splitNotes = doc.splitTextToSize(notes, maxWidth);
    doc.text(splitNotes, settings.margins.left, footerY + 5);
    
    footerY -= splitNotes.length * 3;
  }
  
  // Footer line
  const finalFooterY = pageHeight - settings.margins.bottom - 8;
  
  doc.setDrawColor(...hexToRgb(settings.colors.border));
  doc.setLineWidth(0.5);
  doc.line(settings.margins.left, finalFooterY, pageWidth - settings.margins.right, finalFooterY);
  
  // Footer text with custom styling
  doc.setFontSize(settings.footer.fontSize);
  doc.setTextColor(...hexToRgb(settings.footer.color));
  doc.setFont('helvetica', settings.footer.fontWeight);
  
  let footerX: number;
  switch (settings.footer.position) {
    case 'center':
      footerX = pageWidth / 2;
      doc.text(settings.footer.text, footerX, finalFooterY + 5, { align: 'center' });
      break;
    case 'right':
      footerX = pageWidth - settings.margins.right;
      doc.text(settings.footer.text, footerX, finalFooterY + 5, { align: 'right' });
      break;
    case 'left':
    default:
      footerX = settings.margins.left;
      doc.text(settings.footer.text, footerX, finalFooterY + 5);
      break;
  }
  
  // Custom footer text
  if (settings.footer.customText && settings.footer.customText.trim()) {
    const customY = finalFooterY + 5 + (settings.footer.fontSize * 0.35);
    switch (settings.footer.position) {
      case 'center':
        doc.text(settings.footer.customText, pageWidth / 2, customY, { align: 'center' });
        break;
      case 'right':
        doc.text(settings.footer.customText, pageWidth - settings.margins.right, customY, { align: 'right' });
        break;
      case 'left':
      default:
        doc.text(settings.footer.customText, settings.margins.left, customY);
        break;
    }
  }
  
  // Date if enabled
  if (settings.footer.showDate) {
    const dateText = `Document généré le ${formatDate(new Date())}`;
    const dateY = finalFooterY + 5 + (settings.footer.fontSize * 0.35) + (settings.footer.customText ? (settings.footer.fontSize * 0.35) : 0);
    
    switch (settings.footer.position) {
      case 'center':
        doc.text(dateText, pageWidth / 2, dateY, { align: 'center' });
        break;
      case 'left':
        doc.text(dateText, pageWidth - settings.margins.right, dateY, { align: 'right' });
        break;
      case 'right':
      default:
        doc.text(dateText, settings.margins.left, dateY);
        break;
    }
  }
};

// CRITICAL: New function to render a complete invoice on an existing PDF document
const renderInvoiceOnExistingDocument = async (
  doc: jsPDF, 
  documentData: any, 
  documentTitle: string,
  settings: any,
  companyInfo: any,
  logoUrl?: string
) => {
  // Render document sections with enhanced styling on the current page
  let currentY = renderEnhancedHeader(doc, settings, companyInfo, logoUrl);
  currentY = renderEnhancedTitle(doc, settings, documentTitle, documentData, currentY);
  currentY = renderClientSection(doc, settings, documentData, currentY);
  currentY = renderEnhancedTable(doc, settings, documentData, currentY);
  currentY = renderEnhancedTotalsSection(doc, settings, documentData, currentY);
  renderEnhancedFooter(doc, settings, documentData.notes);
  
  return doc;
};

// Main enhanced document generation function
const generateEnhancedDocument = async (documentData: any, documentTitle: string) => {
  try {
    const doc = new jsPDF();
    const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
    const query = isElectron ? window.electronAPI.dbQuery : undefined;
    
    // Load settings and logo
    const settings = await getTemplateSettings(isElectron, query);
    const logoUrl = await getTemplateLogo(isElectron, query);
    
    // Get company info
    const companyInfo = await getCompanyInfo(isElectron, query);
    
    // Ensure lignes is an array
    if (!Array.isArray(documentData.lignes)) {
      console.warn('Document lignes is not an array, initializing empty array');
      documentData.lignes = [];
    }
    
    // Render document sections with enhanced styling
    let currentY = renderEnhancedHeader(doc, settings, companyInfo, logoUrl);
    currentY = renderEnhancedTitle(doc, settings, documentTitle, documentData, currentY);
    currentY = renderClientSection(doc, settings, documentData, currentY);
    currentY = renderEnhancedTable(doc, settings, documentData, currentY);
    currentY = renderEnhancedTotalsSection(doc, settings, documentData, currentY);
    renderEnhancedFooter(doc, settings, documentData.notes);
    
    return doc;
  } catch (error) {
    console.error('Error generating PDF document:', error);
    throw new Error(`Erreur lors de la génération du PDF: ${error}`);
  }
};

// CRITICAL: New function to create combined PDF with proper template for all pages
export const generateCombinedFacturesPDF = async (factures: Facture[]) => {
  if (factures.length === 0) {
    throw new Error('No invoices provided');
  }

  try {
    const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
    const query = isElectron ? window.electronAPI.dbQuery : undefined;
    
    // Load settings and resources once for efficiency
    const settings = await getTemplateSettings(isElectron, query);
    const logoUrl = await getTemplateLogo(isElectron, query);
    const companyInfo = await getCompanyInfo(isElectron, query);
    
    // Create the first invoice using the proper template
    const firstFactureData = { ...factures[0], type: 'facture' };
    
    // Ensure lignes is an array
    if (!Array.isArray(firstFactureData.lignes)) {
      console.warn('First facture lignes is not an array, initializing empty array');
      firstFactureData.lignes = [];
    }
    
    const combinedDoc = await generateEnhancedDocument(firstFactureData, 'FACTURE');
    
    // Add each subsequent invoice as a new page with full template
    for (let i = 1; i < factures.length; i++) {
      const facture = factures[i];
      const factureData = { ...facture, type: 'facture' };
      
      // Ensure lignes is an array
      if (!Array.isArray(factureData.lignes)) {
        console.warn(`Facture ${i} lignes is not an array, initializing empty array`);
        factureData.lignes = [];
      }
      
      // Add a new page
      combinedDoc.addPage();
      
      // Set to the new page
      combinedDoc.setPage(combinedDoc.internal.getNumberOfPages());
      
      // Render the complete invoice with full template on this page
      await renderInvoiceOnExistingDocument(
        combinedDoc,
        factureData,
        'FACTURE',
        settings,
        companyInfo,
        logoUrl
      );
    }
    
    return combinedDoc;
  } catch (error) {
    console.error('Error generating combined PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF combiné: ${error}`);
  }
};

export const generateFacturePDF = async (facture: Facture) => {
  try {
    // Load lines if not already loaded
    if (!Array.isArray(facture.lignes) || facture.lignes.length === 0) {
      try {
        const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
        const query = isElectron ? window.electronAPI.dbQuery : undefined;
        
        if (query) {
          const lignesResult = await query(`
            SELECT lf.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.stock, p.type
            FROM lignes_facture lf
            JOIN produits p ON lf.produitId = p.id
            WHERE lf.factureId = ?
          `, [facture.id]);
          
          facture.lignes = lignesResult.map((ligne: any) => ({
            id: ligne.id,
            produit: {
              id: ligne.produitId,
              ref: ligne.ref,
              nom: ligne.nom,
              description: ligne.description,
              prixUnitaire: ligne.prixUnitaire,
              tva: ligne.tva,
              stock: ligne.stock,
              type: ligne.type || 'vente'
            },
            quantite: ligne.quantite,
            prixUnitaire: ligne.prixUnitaire,
            remise: ligne.remise,
            montantHT: ligne.montantHT,
            montantTTC: ligne.montantTTC
          }));
        }
      } catch (error) {
        console.error('Error loading facture lines:', error);
      }
    }
    
    // Load taxes if not already loaded
    if (!Array.isArray(facture.taxes) || facture.taxes.length === 0) {
      try {
        const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
        const query = isElectron ? window.electronAPI.dbQuery : undefined;
        
        if (query) {
          // Get active taxes applicable to factures
          const taxesResult = await query(`
            SELECT * FROM taxes 
            WHERE actif = 1 AND json_extract(applicableDocuments, '$') LIKE '%factures%'
            ORDER BY ordre ASC
          `);
          
          if (taxesResult && taxesResult.length > 0) {
            // Calculate taxes based on the facture's total HT
            const totalHT = facture.totalHT;
            let runningTotal = totalHT;
            
            facture.taxes = [];
            facture.totalTaxes = 0;
            
            for (const tax of taxesResult) {
              const applicableDocuments = JSON.parse(tax.applicableDocuments);
              if (!applicableDocuments.includes('factures')) continue;
              
              let base: number;
              let montant: number;
              
              if (tax.type === 'fixed') {
                base = 0;
                montant = tax.valeur;
              } else {
                if (tax.calculationBase === 'totalHT') {
                  base = totalHT;
                } else {
                  base = runningTotal;
                }
                montant = (base * tax.valeur) / 100;
              }
              
              facture.taxes.push({
                taxId: tax.id,
                nom: tax.nom,
                base,
                montant
              });
              
              runningTotal += montant;
              facture.totalTaxes += montant;
            }
            
            // Update totalTTC to include taxes
            facture.totalTTC = facture.totalHT + facture.totalTaxes;
          }
        }
      } catch (error) {
        console.error('Error loading and calculating taxes for facture:', error);
      }
    }
    
    const documentData = {
      ...facture,
      type: 'facture'
    };
    
    return await generateEnhancedDocument(documentData, 'FACTURE');
  } catch (error) {
    console.error('Error generating facture PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF de facture: ${error}`);
  }
};

export const generateDevisPDF = async (devis: Devis) => {
  try {
    // Load lines if not already loaded
    if (!Array.isArray(devis.lignes) || devis.lignes.length === 0) {
      try {
        const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
        const query = isElectron ? window.electronAPI.dbQuery : undefined;
        
        if (query) {
          const lignesResult = await query(`
            SELECT ld.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.stock, p.type
            FROM lignes_devis ld
            JOIN produits p ON ld.produitId = p.id
            WHERE ld.devisId = ?
          `, [devis.id]);
          
          devis.lignes = lignesResult.map((ligne: any) => ({
            id: ligne.id,
            produit: {
              id: ligne.produitId,
              ref: ligne.ref,
              nom: ligne.nom,
              description: ligne.description,
              prixUnitaire: ligne.prixUnitaire,
              tva: ligne.tva,
              stock: ligne.stock,
              type: ligne.type || 'vente'
            },
            quantite: ligne.quantite,
            prixUnitaire: ligne.prixUnitaire,
            remise: ligne.remise,
            montantHT: ligne.montantHT,
            montantTTC: ligne.montantTTC
          }));
        }
      } catch (error) {
        console.error('Error loading devis lines:', error);
      }
    }
    
    // Load taxes if not already loaded
    if (!Array.isArray(devis.taxes) || devis.taxes.length === 0) {
      try {
        const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
        const query = isElectron ? window.electronAPI.dbQuery : undefined;
        
        if (query) {
          // Get active taxes applicable to devis
          const taxesResult = await query(`
            SELECT * FROM taxes 
            WHERE actif = 1 AND json_extract(applicableDocuments, '$') LIKE '%devis%'
            ORDER BY ordre ASC
          `);
          
          if (taxesResult && taxesResult.length > 0) {
            // Calculate taxes based on the devis's total HT
            const totalHT = devis.totalHT;
            let runningTotal = totalHT;
            
            devis.taxes = [];
            devis.totalTaxes = 0;
            
            for (const tax of taxesResult) {
              const applicableDocuments = JSON.parse(tax.applicableDocuments);
              if (!applicableDocuments.includes('devis')) continue;
              
              let base: number;
              let montant: number;
              
              if (tax.type === 'fixed') {
                base = 0;
                montant = tax.valeur;
              } else {
                if (tax.calculationBase === 'totalHT') {
                  base = totalHT;
                } else {
                  base = runningTotal;
                }
                montant = (base * tax.valeur) / 100;
              }
              
              devis.taxes.push({
                taxId: tax.id,
                nom: tax.nom,
                base,
                montant
              });
              
              runningTotal += montant;
              devis.totalTaxes += montant;
            }
            
            // Update totalTTC to include taxes
            devis.totalTTC = devis.totalHT + devis.totalTaxes;
          }
        }
      } catch (error) {
        console.error('Error loading and calculating taxes for devis:', error);
      }
    }
    
    const documentData = {
      ...devis,
      type: 'devis'
    };
    
    return await generateEnhancedDocument(documentData, 'DEVIS');
  } catch (error) {
    console.error('Error generating devis PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF de devis: ${error}`);
  }
};

export const generateBonLivraisonPDF = async (bonLivraison: BonLivraison) => {
  try {
    // Load lines if not already loaded
    if (!Array.isArray(bonLivraison.lignes) || bonLivraison.lignes.length === 0) {
      try {
        const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
        const query = isElectron ? window.electronAPI.dbQuery : undefined;
        
        if (query) {
          const lignesResult = await query(`
            SELECT lbl.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.stock, p.type
            FROM lignes_bon_livraison lbl
            JOIN produits p ON lbl.produitId = p.id
            WHERE lbl.bonLivraisonId = ?
          `, [bonLivraison.id]);
          
          bonLivraison.lignes = lignesResult.map((ligne: any) => ({
            id: ligne.id,
            produit: {
              id: ligne.produitId,
              ref: ligne.ref,
              nom: ligne.nom,
              description: ligne.description,
              prixUnitaire: ligne.prixUnitaire,
              tva: ligne.tva,
              stock: ligne.stock,
              type: ligne.type || 'vente'
            },
            quantite: ligne.quantite,
            prixUnitaire: ligne.produit?.prixUnitaire || 0,
            remise: 0,
            montantHT: (ligne.produit?.prixUnitaire || 0) * ligne.quantite,
            montantTTC: (ligne.produit?.prixUnitaire || 0) * ligne.quantite * (1 + (ligne.produit?.tva || 0) / 100)
          }));
        }
      } catch (error) {
        console.error('Error loading bon de livraison lines:', error);
      }
    }
    
    // Calculate totals for bon de livraison
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    
    if (bonLivraison.lignes && bonLivraison.lignes.length > 0) {
      bonLivraison.lignes.forEach(ligne => {
        const prixUnitaire = ligne.produit.prixUnitaire;
        const montantHT = prixUnitaire * ligne.quantite;
        const montantTTC = montantHT * (1 + ligne.produit.tva / 100);
        
        totalHT += montantHT;
        totalTVA += (montantTTC - montantHT);
        totalTTC += montantTTC;
        
        // Update ligne with calculated values
        ligne.prixUnitaire = prixUnitaire;
        ligne.montantHT = montantHT;
        ligne.montantTTC = montantTTC;
      });
    }
    
    // Load taxes for bon de livraison
    let taxes: any[] = [];
    let totalTaxes = 0;
    
    try {
      const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
      const query = isElectron ? window.electronAPI.dbQuery : undefined;
      
      if (query) {
        // Get active taxes applicable to bonsLivraison
        const taxesResult = await query(`
          SELECT * FROM taxes 
          WHERE actif = 1 AND json_extract(applicableDocuments, '$') LIKE '%bonsLivraison%'
          ORDER BY ordre ASC
        `);
        
        if (taxesResult && taxesResult.length > 0) {
          let runningTotal = totalHT;
          
          for (const tax of taxesResult) {
            const applicableDocuments = JSON.parse(tax.applicableDocuments);
            if (!applicableDocuments.includes('bonsLivraison')) continue;
            
            let base: number;
            let montant: number;
            
            if (tax.type === 'fixed') {
              base = 0;
              montant = tax.valeur;
            } else {
              if (tax.calculationBase === 'totalHT') {
                base = totalHT;
              } else {
                base = runningTotal;
              }
              montant = (base * tax.valeur) / 100;
            }
            
            taxes.push({
              taxId: tax.id,
              nom: tax.nom,
              base,
              montant
            });
            
            runningTotal += montant;
            totalTaxes += montant;
          }
        }
      }
    } catch (error) {
      console.error('Error loading and calculating taxes for bon de livraison:', error);
    }
    
    // Update totalTTC to include taxes
    totalTTC += totalTaxes;
    
    const documentData = {
      ...bonLivraison,
      type: 'bonLivraison',
      totalHT,
      totalTVA,
      totalTTC,
      taxes,
      totalTaxes
    };
    
    return await generateEnhancedDocument(documentData, 'BON DE LIVRAISON');
  } catch (error) {
    console.error('Error generating bon de livraison PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF de bon de livraison: ${error}`);
  }
};

export const generateCommandeFournisseurPDF = async (commande: CommandeFournisseur) => {
  try {
    // Load lines if not already loaded
    if (!Array.isArray(commande.lignes) || commande.lignes.length === 0) {
      try {
        const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
        const query = isElectron ? window.electronAPI.dbQuery : undefined;
        
        if (query) {
          const lignesResult = await query(`
            SELECT lcf.*, p.ref, p.nom, p.description, p.prixUnitaire, p.tva, p.stock, p.type
            FROM lignes_commande_fournisseur lcf
            JOIN produits p ON lcf.produitId = p.id
            WHERE lcf.commandeId = ?
          `, [commande.id]);
          
          commande.lignes = lignesResult.map((ligne: any) => ({
            id: ligne.id,
            produit: {
              id: ligne.produitId,
              ref: ligne.ref,
              nom: ligne.nom,
              description: ligne.description,
              prixUnitaire: ligne.prixUnitaire,
              tva: ligne.tva,
              stock: ligne.stock,
              type: ligne.type || 'achat'
            },
            quantite: ligne.quantite,
            prixUnitaire: ligne.prixUnitaire,
            remise: ligne.remise,
            montantHT: ligne.montantHT,
            montantTTC: ligne.montantTTC
          }));
        }
      } catch (error) {
        console.error('Error loading commande fournisseur lines:', error);
      }
    }
    
    // Load taxes if not already loaded
    if (!Array.isArray(commande.taxes) || commande.taxes.length === 0) {
      try {
        const isElectron = typeof window !== 'undefined' && window.electronAPI ? true : false;
        const query = isElectron ? window.electronAPI.dbQuery : undefined;
        
        if (query) {
          // Get active taxes applicable to commandesFournisseur
          const taxesResult = await query(`
            SELECT * FROM taxes 
            WHERE actif = 1 AND json_extract(applicableDocuments, '$') LIKE '%commandesFournisseur%'
            ORDER BY ordre ASC
          `);
          
          if (taxesResult && taxesResult.length > 0) {
            // Calculate taxes based on the commande's total HT
            const totalHT = commande.totalHT;
            let runningTotal = totalHT;
            
            commande.taxes = [];
            commande.totalTaxes = 0;
            
            for (const tax of taxesResult) {
              const applicableDocuments = JSON.parse(tax.applicableDocuments);
              if (!applicableDocuments.includes('commandesFournisseur')) continue;
              
              let base: number;
              let montant: number;
              
              if (tax.type === 'fixed') {
                base = 0;
                montant = tax.valeur;
              } else {
                if (tax.calculationBase === 'totalHT') {
                  base = totalHT;
                } else {
                  base = runningTotal;
                }
                montant = (base * tax.valeur) / 100;
              }
              
              commande.taxes.push({
                taxId: tax.id,
                nom: tax.nom,
                base,
                montant
              });
              
              runningTotal += montant;
              commande.totalTaxes += montant;
            }
            
            // Update totalTTC to include taxes
            commande.totalTTC = commande.totalHT + commande.totalTaxes;
          }
        }
      } catch (error) {
        console.error('Error loading and calculating taxes for commande:', error);
      }
    }
    
    const documentData = {
      ...commande,
      type: 'commande'
    };
    
    return await generateEnhancedDocument(documentData, 'COMMANDE FOURNISSEUR');
  } catch (error) {
    console.error('Error generating commande fournisseur PDF:', error);
    throw new Error(`Erreur lors de la génération du PDF de commande fournisseur: ${error}`);
  }
};