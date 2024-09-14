const multer = require('multer');
const fs = require('fs').promises; // Usando fs.promises para manipulação de arquivos
const sharp = require('sharp');
const express = require('express');

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Adicione esta linha para processar dados do formulário
app.use(express.urlencoded({ extended: true }));

// Definir a porta
const PORT = process.env.PORT || 3000;

// Função atualizada para criar imagem de texto sem fundo
const createTextImage = async (text, width, height, rotation = 0, font, fontSize = 24, isBold = false) => {
    const fontWeight = isBold ? 'bold' : 'normal';
    const svgBuffer = Buffer.from(`
        <svg width="${width}" height="${height}">
            <style>
                .text {
                    font-family: ${font}, sans-serif;
                    font-size: ${fontSize}px;
                    font-weight: ${fontWeight};
                    fill: white;
                    text-shadow: 0 0 15px white, 0 0 10px white, 0 0 5px white;
                }
            </style>
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="text">
                ${fitTextToBox(text, width, height, fontSize)}
            </text>
        </svg>
    `);
    return sharp(svgBuffer).png().toBuffer();
};

const fitTextToBox = (text, width, height, fontSize) => {
    if (!text) return ''; // Retorna uma string vazia se o texto for undefined ou null
    
    const maxChars = Math.floor(width / (fontSize * 0.6));
    const maxLines = Math.floor(height / (fontSize * 1.2));
    const words = text.toString().split(' '); // Converte para string antes de usar split
    let lines = [];
    let currentLine = '';

    for (let word of words) {
        if ((currentLine + word).length <= maxChars) {
            currentLine += (currentLine ? ' ' : '') + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);

    if (lines.length > maxLines) {
        const scaleFactor = maxLines / lines.length;
        fontSize = Math.floor(fontSize * scaleFactor);
        return fitTextToBox(text, width, height, fontSize);
    }

    return lines.map((line, index) => 
        `<tspan x="50%" dy="${index === 0 ? '0' : '1.2em'}" font-size="${fontSize}px">${line}</tspan>`
    ).join('');
};

// Rota para upload e geração do flyer
app.post('/upload', upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'topImage', maxCount: 1 }
]), async (req, res) => {
    const mainImage = req.files['mainImage'] ? req.files['mainImage'][0] : null;
    const topImage = req.files['topImage'] ? req.files['topImage'][0] : null;
    const bottomText = req.body.bottomText || '';
    const additionalText = req.body.additionalText || '';
    const leftText = req.body.leftText || '';
    const leftBottomText = req.body.leftBottomText || '';
    const rightTopText = req.body.rightTopText || '';
    const rightCenterText = req.body.rightCenterText || '';
    const rightBottomText = req.body.rightBottomText || '';
    const fontType = req.body.fontType || 'Arial';
    const flyerTemplate = 'flyer-template.png';
    const outputFlyer = `flyers/flyer-${Date.now()}.png`;

    try {
        if (!mainImage || !topImage) {
            throw new Error('Ambas as imagens são necessárias.');
        }

        console.log('Informações da imagem principal:', {
            originalname: mainImage.originalname,
            mimetype: mainImage.mimetype,
            size: mainImage.size
        });

        // Obter as dimensões do template
        const templateMetadata = await sharp(flyerTemplate).metadata();
        const templateWidth = templateMetadata.width;
        const templateHeight = templateMetadata.height;

        // Definir posições e dimensões
        const topImageHeight = Math.floor(templateHeight * 0.2);
        const mainImageTop = topImageHeight;
        const mainImageHeight = Math.floor(templateHeight * 0.6);
        const textStartY = mainImageTop + mainImageHeight;
        const sideTextWidth = Math.floor(templateWidth * 0.15); // 15% da largura

        // Processar a imagem principal do usuário
        const mainImageMetadata = await sharp(mainImage.buffer).metadata();
        const mainImageAspectRatio = mainImageMetadata.width / mainImageMetadata.height;
        const mainImageWidth = Math.floor(Math.min(templateWidth - 2 * sideTextWidth, mainImageHeight * mainImageAspectRatio));
        const mainImageLeft = Math.floor(sideTextWidth + (templateWidth - 2 * sideTextWidth - mainImageWidth) / 2);

        console.log('Processando imagem principal...');
        let mainImageBuffer;
        try {
            mainImageBuffer = await sharp(mainImage.buffer)
                .resize({
                    width: mainImageWidth,
                    height: mainImageHeight,
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .toBuffer();
        } catch (error) {
            console.error('Erro detalhado ao processar imagem principal:', error);
            throw new Error('Erro ao processar imagem principal: ' + error.message);
        }

        console.log('Processando imagem do topo...');
        let topImageBuffer;
        try {
            topImageBuffer = await sharp(topImage.buffer)
                .resize({
                    width: Math.floor(templateWidth),
                    height: topImageHeight,
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .toBuffer();
        } catch (error) {
            console.error('Erro ao processar imagem do topo:', error);
            throw new Error('Erro ao processar imagem do topo');
        }

        // Verificar se o template existe
        try {
            await fs.access(flyerTemplate);
        } catch (error) {
            throw new Error('Template do flyer não encontrado.');
        }

        // Definir tamanhos fixos para as caixas de texto
        const bottomTextSize = { width: Math.floor(templateWidth - 2 * sideTextWidth), height: Math.floor(templateHeight * 0.1) };
        const sideTextSize = { width: sideTextWidth, height: Math.floor(templateHeight * 0.25) };
        const leftTextSize = { width: sideTextWidth, height: Math.floor(templateHeight * 0.5) };

        // Criar imagens de texto com tamanhos predefinidos
        const bottomTextImage = await createTextImage(bottomText, bottomTextSize.width, bottomTextSize.height, 0, fontType, 32);
        const additionalTextImage = await createTextImage(additionalText, bottomTextSize.width, bottomTextSize.height, 0, fontType, 32, true);
        const leftTextImage = await createTextImage(leftText, leftTextSize.width, leftTextSize.height, 0, fontType, 20);
        const leftBottomTextImage = await createTextImage(leftBottomText, sideTextSize.width, sideTextSize.height, 0, fontType, 20);
        const rightTopTextImage = await createTextImage(rightTopText, sideTextSize.width, sideTextSize.height, 0, fontType, 20);
        const rightCenterTextImage = await createTextImage(rightCenterText, sideTextSize.width, sideTextSize.height, 0, fontType, 20);
        const rightBottomTextImage = await createTextImage(rightBottomText, sideTextSize.width, sideTextSize.height, 0, fontType, 20);

        // Escurecer o template
        const darkenedTemplateBuffer = await sharp(flyerTemplate)
            .composite([{
                input: Buffer.from([0, 0, 0, 128]), // Camada preta semi-transparente (50% de opacidade)
                raw: {
                    width: 1,
                    height: 1,
                    channels: 4
                },
                tile: true,
                blend: 'multiply'
            }])
            .toBuffer();

        // Combinar as imagens com o template do flyer escurecido
        await sharp(darkenedTemplateBuffer)
            .composite([
                { input: topImageBuffer, top: 0, left: 0 },
                { input: mainImageBuffer, top: mainImageTop, left: mainImageLeft },
                { input: bottomTextImage, top: textStartY, left: sideTextWidth },
                { input: additionalTextImage, top: textStartY + Math.floor(templateHeight * 0.1), left: sideTextWidth },
                { input: leftTextImage, top: 0, left: 0 },
                { input: leftBottomTextImage, top: Math.floor(templateHeight * 0.5), left: 0 },
                { input: rightTopTextImage, top: 0, left: templateWidth - sideTextWidth },
                { input: rightCenterTextImage, top: Math.floor(templateHeight * 0.25), left: templateWidth - sideTextWidth },
                { input: rightBottomTextImage, top: Math.floor(templateHeight * 0.5), left: templateWidth - sideTextWidth }
            ])
            .toFile(outputFlyer);

        // Enviar o flyer gerado para download
        res.download(outputFlyer, 'meu-flyer.png', async (err) => {
            if (err) {
                console.error('Erro ao enviar o arquivo para download:', err);
                res.status(500).send('Erro ao gerar o flyer.');
            } else {
                // Após o download, deletar o flyer gerado e as imagens temporárias
                await fs.unlink(outputFlyer);
                await fs.unlink(mainImage.path);
                await fs.unlink(topImage.path);
            }
        });
    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).send('Erro ao gerar o flyer: ' + error.message);
    }
});

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Servir arquivos estáticos
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
