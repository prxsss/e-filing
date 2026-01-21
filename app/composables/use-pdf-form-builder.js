export function usePdfFormBuilder() {
  const formName = ref('');
  const pdfFile = ref(null);
  const pdfDoc = shallowRef(null); // Use shallowRef to avoid Vue's deep reactivity
  const pdfLoaded = ref(false);
  const currentPage = ref(1);
  const totalPages = ref(0);
  const isDragging = ref(false);
  const placedFields = ref([]);
  const fieldCounter = ref(0);
  const selectedField = ref(null);
  const dragState = ref(null);
  const resizeState = ref(null);
  const savedData = ref(null);
  const scale = ref(1.5);
  const pdfjsLib = shallowRef(null); // Use shallowRef for PDF.js library too

  const fileInput = ref(null);
  const pdfCanvas = ref(null);

  const availableFields = [
    { id: 'text', name: 'Text Field', icon: '📝', type: 'text' },
    { id: 'signature', name: 'Signature', icon: '✍️', type: 'signature' },
    { id: 'date', name: 'Date', icon: '📅', type: 'date' },
    { id: 'checkbox', name: 'Checkbox', icon: '☑️', type: 'checkbox' },
    { id: 'number', name: 'Number', icon: '🔢', type: 'number' },
  ];

  const currentPageFields = computed(() => {
    return placedFields.value.filter(f => f.page === currentPage.value);
  });

  // Initialize PDF.js
  const initPdfJs = async () => {
    if (pdfjsLib.value)
      return pdfjsLib.value;

    try {
      // Import PDF.js dynamically
      const pdfjs = await import('pdfjs-dist');

      // Set worker source
      if (import.meta.client) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      }

      pdfjsLib.value = pdfjs;
      return pdfjs;
    }
    catch (error) {
      console.error('Error loading PDF.js:', error);
      throw new Error('Failed to load PDF library');
    }
  };

  const triggerFileInput = () => {
    if (fileInput.value) {
      fileInput.value.click();
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      loadPDF(file);
    }
    else {
      console.error('Please select a valid PDF file');
    }
  };

  const handleFileDrop = (event) => {
    isDragging.value = false;
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      loadPDF(file);
    }
    else {
      console.error('Please select a valid PDF file');
    }
  };

  async function loadPDF(file) {
    try {
      pdfFile.value = file;

      // Initialize PDF.js if not already done
      const pdfjs = await initPdfJs();

      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);

          // Load the PDF document
          const loadingTask = pdfjs.getDocument({
            data: typedarray,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
          });

          // Store the document without Vue reactivity wrapping
          const loadedDoc = await loadingTask.promise;
          pdfDoc.value = loadedDoc;

          totalPages.value = loadedDoc.numPages;
          currentPage.value = 1;
          pdfLoaded.value = true;
          placedFields.value = [];
          selectedField.value = null;
          savedData.value = null;

          // Wait for DOM to update
          await nextTick();

          // Small delay to ensure canvas is ready
          setTimeout(async () => {
            await renderPage(1);
          }, 100);
        }
        catch (error) {
          console.error('Error loading PDF:', error);
          console.error(`Error loading PDF file: ${error.message}`);
          pdfLoaded.value = false;
        }
      };

      fileReader.onerror = (error) => {
        console.error('FileReader error:', error);
        console.error('Error reading file');
      };

      fileReader.readAsArrayBuffer(file);
    }
    catch (error) {
      console.error('Error in loadPDF:', error);
      console.error(`Error loading PDF: ${error.message}`);
    }
  };

  async function renderPage(pageNum) {
    if (!pdfDoc.value || !pdfCanvas.value) {
      console.warn('PDF document or canvas not ready');
      return;
    }

    try {
      const page = await pdfDoc.value.getPage(pageNum);
      const canvas = pdfCanvas.value;
      const context = canvas.getContext('2d');

      const viewport = page.getViewport({ scale: scale.value });

      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      // Render the page
      await page.render(renderContext).promise;
    }
    catch (error) {
      console.error('Error rendering page:', error);
      console.error(`Error rendering PDF page: ${error.message}`);
    }
  };

  const changePage = async () => {
    await renderPage(currentPage.value);
  };

  const addField = (fieldTemplate) => {
    if (!pdfLoaded.value)
      return;

    fieldCounter.value++;
    const newField = {
      id: `field_${fieldCounter.value}`,
      name: `${fieldTemplate.name} ${fieldCounter.value}`,
      type: fieldTemplate.type,
      page: currentPage.value,
      x: 50,
      y: 50,
      width: 150,
      height: 40,
    };

    placedFields.value.push(newField);
    selectedField.value = newField.id;
  };

  const selectField = (fieldId) => {
    selectedField.value = fieldId;
  };

  const deleteField = (fieldId) => {
    placedFields.value = placedFields.value.filter(f => f.id !== fieldId);
    if (selectedField.value === fieldId) {
      selectedField.value = null;
    }
  };

  const startDrag = (event, field) => {
    if (event.target.classList.contains('resize-handle'))
      return;

    selectedField.value = field.id;
    dragState.value = {
      field,
      startX: event.clientX,
      startY: event.clientY,
      initialX: field.x,
      initialY: field.y,
    };

    if (import.meta.client) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
    }
  };

  function handleDrag(event) {
    if (!dragState.value)
      return;

    const deltaX = event.clientX - dragState.value.startX;
    const deltaY = event.clientY - dragState.value.startY;

    dragState.value.field.x = Math.max(0, dragState.value.initialX + deltaX);
    dragState.value.field.y = Math.max(0, dragState.value.initialY + deltaY);
  }

  function stopDrag() {
    dragState.value = null;
    if (import.meta.client) {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
    }
  }

  const startResize = (event, field, handle) => {
    resizeState.value = {
      field,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      initialX: field.x,
      initialY: field.y,
      initialWidth: field.width,
      initialHeight: field.height,
    };

    if (import.meta.client) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
    }
  };

  function handleResize(event) {
    if (!resizeState.value)
      return;

    const deltaX = event.clientX - resizeState.value.startX;
    const deltaY = event.clientY - resizeState.value.startY;
    const { field, handle, initialX, initialY, initialWidth, initialHeight }
      = resizeState.value;

    switch (handle) {
      case 'se':
        field.width = Math.max(50, initialWidth + deltaX);
        field.height = Math.max(30, initialHeight + deltaY);
        break;
      case 'sw':
        field.width = Math.max(50, initialWidth - deltaX);
        field.height = Math.max(30, initialHeight + deltaY);
        field.x = initialX + (initialWidth - field.width);
        break;
      case 'ne':
        field.width = Math.max(50, initialWidth + deltaX);
        field.height = Math.max(30, initialHeight - deltaY);
        field.y = initialY + (initialHeight - field.height);
        break;
      case 'nw':
        field.width = Math.max(50, initialWidth - deltaX);
        field.height = Math.max(30, initialHeight - deltaY);
        field.x = initialX + (initialWidth - field.width);
        field.y = initialY + (initialHeight - field.height);
        break;
    }
  }

  function stopResize() {
    resizeState.value = null;
    if (import.meta.client) {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
    }
  }

  const saveForm = () => {
    const canvas = pdfCanvas.value;
    if (!canvas) {
      console.error('Canvas not ready');
      return;
    }

    if (placedFields.value.length === 0) {
      console.error('Please add at least one field before saving');
      return;
    }

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Prepare data to save to database
    const formData = {
      formName: formName.value || 'Untitled Form',
      pdfFileName: pdfFile.value.name,
      totalPages: totalPages.value,
      fields: placedFields.value.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        page: field.page,
        position: {
          x: field.x,
          y: field.y,
          // Convert to percentage for responsiveness
          xPercent: ((field.x / canvasWidth) * 100).toFixed(2),
          yPercent: ((field.y / canvasHeight) * 100).toFixed(2),
        },
        size: {
          width: field.width,
          height: field.height,
          // Convert to percentage for responsiveness
          widthPercent: ((field.width / canvasWidth) * 100).toFixed(2),
          heightPercent: ((field.height / canvasHeight) * 100).toFixed(2),
        },
      })),
      createdAt: new Date().toISOString(),
    };

    savedData.value = JSON.stringify(formData, null, 2);

    console.warn(
      'Form saved! Check the output below to see the data that would be saved to the database.',
    );
  };

  // Cleanup on unmount
  onBeforeUnmount(() => {
    if (import.meta.client) {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
    }
  });

  return {
    formName,
    pdfFile,
    pdfLoaded,
    currentPage,
    totalPages,
    isDragging,
    availableFields,
    placedFields,
    selectedField,
    savedData,
    currentPageFields,
    fileInput,
    pdfCanvas,
    triggerFileInput,
    handleFileSelect,
    handleFileDrop,
    changePage,
    addField,
    selectField,
    deleteField,
    startDrag,
    startResize,
    saveForm,
  };
}
