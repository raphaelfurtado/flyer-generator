async function compressImage(file) {
    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
    }
    try {
        return await imageCompression(file, options);
    } catch (error) {
        console.error("Erro na compressão:", error);
        return file;
    }
}

document.getElementById('flyerForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData();

    const mainImage = document.getElementById('mainImage').files[0];
    const topImage = document.getElementById('topImage').files[0];

    if (mainImage) {
        const compressedMainImage = await compressImage(mainImage);
        formData.append('mainImage', compressedMainImage, compressedMainImage.name);
    }

    if (topImage) {
        const compressedTopImage = await compressImage(topImage);
        formData.append('topImage', compressedTopImage, compressedTopImage.name);
    }

    // Adicionar outros campos do formulário
    // formData.append('bottomText', document.getElementById('bottomText').value);
    // ... outros campos ...

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'flyer.png';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            alert('Erro ao gerar o flyer');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao enviar o formulário');
    }
});