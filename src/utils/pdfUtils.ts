import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// Загрузка шрифтов для кириллицы
// Примечание: Для полной поддержки кириллицы нужно добавить кастомный шрифт
// Здесь используем базовый вариант

interface InvoiceData {
  number: string
  date: Date
  customerName: string
  customerPhone?: string
  vehicleBrand: string
  vehicleModel: string
  licensePlate?: string
  vin?: string
  services: Array<{
    name: string
    price: number
    quantity: number
  }>
  parts: Array<{
    name: string
    price: number
    quantity: number
  }>
  workTotal: number
  partsTotal: number
  total: number
}

interface AppointmentReportData {
  requestNumber: string
  date: Date
  customerName: string
  customerPhone?: string
  vehicleInfo: string
  description: string
  assignedTo?: string
  status: string
  notes?: string
}

export const pdfUtils = {
  // Генерация счета (Invoice)
  generateInvoice: (data: InvoiceData, companyName: string = 'СТО') => {
    const doc = new jsPDF()
    
    // Заголовок
    doc.setFontSize(20)
    doc.text(companyName, 105, 20, { align: 'center' })
    
    doc.setFontSize(16)
    doc.text(`Счет №${data.number}`, 105, 30, { align: 'center' })
    
    doc.setFontSize(10)
    doc.text(`Дата: ${format(data.date, 'dd.MM.yyyy', { locale: ru })}`, 105, 38, { align: 'center' })
    
    // Информация о клиенте
    doc.setFontSize(12)
    doc.text('Клиент:', 14, 50)
    doc.setFontSize(10)
    doc.text(data.customerName, 14, 56)
    if (data.customerPhone) {
      doc.text(`Тел: ${data.customerPhone}`, 14, 62)
    }
    
    // Информация об автомобиле
    doc.setFontSize(12)
    doc.text('Автомобиль:', 14, 72)
    doc.setFontSize(10)
    doc.text(`${data.vehicleBrand} ${data.vehicleModel}`, 14, 78)
    if (data.licensePlate) {
      doc.text(`Гос. номер: ${data.licensePlate}`, 14, 84)
    }
    if (data.vin) {
      doc.text(`VIN: ${data.vin}`, 14, 90)
    }
    
    let yPos = 100
    
    // Таблица услуг
    if (data.services.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Услуга', 'Кол-во', 'Цена', 'Сумма']],
        body: data.services.map(s => [
          s.name,
          s.quantity,
          `${s.price.toFixed(2)} грн`,
          `${(s.price * s.quantity).toFixed(2)} грн`
        ]),
        foot: [['', '', 'Итого работы:', `${data.workTotal.toFixed(2)} грн`]],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
        footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
      })
      yPos = (doc as any).lastAutoTable.finalY + 10
    }
    
    // Таблица запчастей
    if (data.parts.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Запчасть', 'Кол-во', 'Цена', 'Сумма']],
        body: data.parts.map(p => [
          p.name,
          p.quantity,
          `${p.price.toFixed(2)} грн`,
          `${(p.price * p.quantity).toFixed(2)} грн`
        ]),
        foot: [['', '', 'Итого запчасти:', `${data.partsTotal.toFixed(2)} грн`]],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
        footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
      })
      yPos = (doc as any).lastAutoTable.finalY + 10
    }
    
    // Итого
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`ИТОГО: ${data.total.toFixed(2)} грн`, 14, yPos)
    
    return doc
  },

  // Генерация заказ-наряда
  generateWorkOrder: (data: AppointmentReportData, companyName: string = 'СТО') => {
    const doc = new jsPDF()
    
    // Заголовок
    doc.setFontSize(20)
    doc.text(companyName, 105, 20, { align: 'center' })
    
    doc.setFontSize(16)
    doc.text('ЗАКАЗ-НАРЯД', 105, 30, { align: 'center' })
    
    doc.setFontSize(12)
    doc.text(`№ ${data.requestNumber}`, 105, 38, { align: 'center' })
    doc.text(`от ${format(data.date, 'dd MMMM yyyy', { locale: ru })}`, 105, 45, { align: 'center' })
    
    // Информация
    let yPos = 60
    doc.setFontSize(11)
    
    doc.text('Клиент:', 14, yPos)
    doc.setFont('helvetica', 'bold')
    doc.text(data.customerName, 50, yPos)
    doc.setFont('helvetica', 'normal')
    
    if (data.customerPhone) {
      yPos += 7
      doc.text('Телефон:', 14, yPos)
      doc.text(data.customerPhone, 50, yPos)
    }
    
    yPos += 7
    doc.text('Автомобиль:', 14, yPos)
    doc.setFont('helvetica', 'bold')
    doc.text(data.vehicleInfo, 50, yPos)
    doc.setFont('helvetica', 'normal')
    
    if (data.assignedTo) {
      yPos += 7
      doc.text('Мастер:', 14, yPos)
      doc.text(data.assignedTo, 50, yPos)
    }
    
    yPos += 7
    doc.text('Статус:', 14, yPos)
    doc.text(data.status, 50, yPos)
    
    yPos += 12
    doc.setFont('helvetica', 'bold')
    doc.text('Описание работ:', 14, yPos)
    doc.setFont('helvetica', 'normal')
    
    yPos += 7
    const descLines = doc.splitTextToSize(data.description || 'Не указано', 180)
    doc.text(descLines, 14, yPos)
    yPos += descLines.length * 7
    
    if (data.notes) {
      yPos += 10
      doc.setFont('helvetica', 'bold')
      doc.text('Примечания:', 14, yPos)
      doc.setFont('helvetica', 'normal')
      
      yPos += 7
      const notesLines = doc.splitTextToSize(data.notes, 180)
      doc.text(notesLines, 14, yPos)
    }
    
    // Подписи
    yPos = 250
    doc.line(14, yPos, 80, yPos)
    doc.line(120, yPos, 186, yPos)
    
    doc.setFontSize(9)
    doc.text('Подпись мастера', 14, yPos + 5)
    doc.text('Подпись клиента', 120, yPos + 5)
    
    return doc
  },

  // Сохранение PDF
  savePDF: (doc: jsPDF, filename: string) => {
    doc.save(filename)
  },

  // Открытие PDF в новой вкладке
  openPDF: (doc: jsPDF) => {
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  },
}
