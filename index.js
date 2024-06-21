const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const wwebVersion = '2.2412.54';

// Constantes para comandos
const COMMAND_ENTER = 'entrar na lista';
const COMMAND_OPEN = 'abrir lista';
const COMMAND_LEAVE = 'sair da lista';
const COMMAND_SHOW = 'mostrar lista';
const COMMAND_DRAW = 'sortear times';
const COMMAND_NEXT = 'proxima partida';
const COMMAND_CURRENT_MATCH = 'partida atual';
const COMMAND_HELP = '!help';
const COMMAND_MATCH_DRAW = 'partida empate';
const COMMAND_SHOW_TEAMS = 'mostrar times';
const COMMAND_LOST = /^perde time (\d+)$/;
const COMMAND_REMOVE_PLAYER = /remover jogador (.+)$/i;
const COMMAND_ADD_PLAYER = /adicionar jogador (.+)$/i;

// ID do grupo específico
// const specificGroup = 'Futebol das Terças ⚽';
const specificGroup = 'wards';

// Variáveis para gerenciar os confirmados e o jogo
let confirmados = [
    'Ronaldo Fenomeno',
    'Cristiano Ronaldo',
    'Lionel Messi',
    'Neymar Jr.',
    'Kylian Mbappe',
    'Luka Modric',
    'Mohamed Salah',
    'Robert Lewandowski',
    'Sergio Ramos',
    'Virgil van Dijk',
    'Manuel Neuer',
    'Paulo Dybala',
    'Eden Hazard',
    'Raheem Sterling',
    'Harry Kane',
    'Sadio Mane',
    'Toni Kroos',
    'Paul Pogba',
    'Zlatan Ibrahimovic'
];
let listaAberta = false;
let chat = null;
let contact = null;

// Limite máximo de pessoas na lista
const limiteMaximo = 23;

// Variáveis para gerenciar os times e a rotação
let times = []; // Array para armazenar os times
let proximoTimeIndex = 0; // Índice do próximo time na sequência
let proximaPartidaIndex = 0; // Índice da próxima partida na sequência
let partidaAtual = [];

let loser = null;

// Inicializar o cliente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {},
    webVersionCache: {
        type: 'remote',
        remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${wwebVersion}.html`,
    },
});

// Gera o QR code para autenticação
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Mensagem de log quando o bot está autenticado e pronto
client.on('ready', () => {
    console.log('Bot está pronto!');
});

// Responder à mensagem específica em um grupo específico
client.on('message_create', async message => {
    console.log('Recebendo mensagem: ' + message.body + ' FROM: ' + JSON.stringify(message.from));
    chat = await message.getChat();
    contact = await message.getContact();
    const body = message.body.toLowerCase().trim();

    // Verifica se a mensagem foi enviada no grupo específico
    if (chat.name === specificGroup) {
        if (COMMAND_LOST.test(body)) {
            const match = body.match(COMMAND_LOST);
            const teamNumber = parseInt(match[1], 10);
            handleTeamLost(message, teamNumber);
        } if (COMMAND_ADD_PLAYER.test(body)) {
            const match = message.body.match(COMMAND_ADD_PLAYER);
            const player = match[1];
            handleAddPlayer(message, player);
        } if (COMMAND_REMOVE_PLAYER.test(body)) {
            const match = body.match(COMMAND_REMOVE_PLAYER);
            const player = match[1];
            handleRemovePlayer(message, player);
        } else {
            switch (body) {
                case COMMAND_ENTER:
                    handleEnterList(message);
                    break;
                case COMMAND_OPEN:
                    handleOpenList(message);
                    break;
                case COMMAND_LEAVE:
                    handleLeaveList(message);
                    break;
                case COMMAND_DRAW:
                    handleDrawTeams(message);
                    break;
                case COMMAND_NEXT:
                    handleNextMatch(message);
                    break;
                case COMMAND_HELP:
                    handleHelp(message);
                    break;
                case COMMAND_SHOW:
                    handleShowList(message);
                    break;
                case COMMAND_SHOW_TEAMS:
                    handleShowTeams(message);
                    break;
                case COMMAND_CURRENT_MATCH:
                    handleShowCurrentMatch(message);
                    break;
                case COMMAND_MATCH_DRAW:
                    handleMatchDraw(message);
                    break;
                default:
                    // message.reply('Comando inválido. Envie "!help" para ver a lista de comandos disponíveis.');
                    break;
            }
        }
    }
});

// verifica as permissoes do usuario com o grupo
async function isAdmin() {
    return new Promise(function (resolve, reject) {
        let can = false;
        chat.participants.forEach(function (participant) {
            if (participant.id.user == contact.id.user) {
                if (participant.isAdmin) {
                    can = true;
                }
            }
        });

        if (contact.isMe) {
            can = true;
        }
        resolve(can);
    });
}
// Função para adicionar um jogador à lista de confirmados
function handleEnterList(message) {
    if (!listaAberta) {
        message.reply('A lista não está aberta para adições no momento.');
        return;
    }

    if (confirmados.length >= limiteMaximo) {
        message.reply(`Desculpe, já atingimos o número máximo de ${limiteMaximo} pessoas na lista.`);
        return;
    }

    const nomeRemetente = message.rawData.notifyName;
    if (!confirmados.includes(nomeRemetente)) {
        confirmados.push(nomeRemetente);
    }

    message.reply(formatarListaConfirmados());
}

// Função para exibir a lista de confirmados
function handleShowList(message) {
    message.reply(formatarListaConfirmados());
}

// Função para abrir a lista de confirmados
async function handleOpenList(message) {
    if (!await isAdmin()) {
        message.reply('Apenas o administrador do grupo pode abrir e fechar a lista.');
        return;
    }

    listaAberta = true;
    message.reply('A lista está aberta para adições. Envie "entrar na lista" para se adicionar.');

}

// Função para remover um jogador da lista de confirmados
function handleLeaveList(message, player = null) {
    if (!player) {
        player = message.rawData.notifyName;
    }
    const index = confirmados.findIndex(p => p.toLowerCase().trim() == player.toLowerCase().trim());
    if (index !== -1) {
        confirmados.splice(index, 1);
        message.reply(formatarListaConfirmados());
    } else {
        message.reply(`Jogador não está na lista de confirmados.`);
    }
}

// Função para sortear os times
async function handleDrawTeams(message) {
    if (!await isAdmin()) {
        message.reply('Apenas o administrador do grupo pode sortear os times.');
        return;
    }
    const mensagemTimes = sortearTimes();
    message.reply(mensagemTimes);
}

// Função para mostrar os times sorteados
function handleShowTeams(message) {
    if (times.length === 0) {
        message.reply('Os times ainda não foram sorteados.');
    } else {
        let mensagem = 'Times sorteados:\n\n';
        times.forEach((time, index) => {
            mensagem += `Time ${index + 1}:\n`;
            time.forEach((jogador, idx) => {
                mensagem += `${idx + 1} - ${jogador}\n`;
            });
            mensagem += '\n';
        });
        message.reply(mensagem);
    }
}

// Função para responder à próxima partida na sequência
function handleNextMatch(message) {
    if (loser == null && partidaAtual.length > 0) {
        message.reply('perdedor não informado.');
        return;
    }
    if (times.length == 0) {
        message.reply('Times não sorteados.');
        return;
    }

    let time1 = times[proximoTimeIndex];
    let time2 = times[(proximoTimeIndex + 1) % times.length];
    if (loser) {
        time1 = times[partidaAtual[0]];
        time2 = times[proximoTimeIndex + 1];
        partidaAtual = [partidaAtual[0], proximoTimeIndex + 1];
    } else {
        partidaAtual = [proximoTimeIndex, proximoTimeIndex + 1];
    }

    let mensagem = `Próxima partida:\n\n`;
    mensagem += `*Partida ${proximaPartidaIndex + 1} * \n *Time ${partidaAtual[0] + 1}*\n`;
    mensagem += `${formatarJogadores(time1)} \n\n vs  \n *Time ${partidaAtual[1] + 1}* \n\n ${formatarJogadores(time2)}\n\n`;

    if (loser == null) {
        proximoTimeIndex = (proximoTimeIndex + 1) % times.length; // Avança para o próximo time na sequência circular
    } else {
        loser = null;
        proximoTimeIndex++;
    }

    proximaPartidaIndex++;
    message.reply(mensagem);
}

// define que ouve empate
function handleMatchDraw(message) {
    if (times.length == 0) {
        message.reply('Times não sorteados.');
        return;
    }

    if (partidaAtual.length == 0) {
        message.reply('Nenhuma partida encontrada.');
        return;
    }
    partidaAtual = [];
    loser = null;
    proximoTimeIndex++;
    handleNextMatch(message);
}

//exibe a partida atual
function handleShowCurrentMatch(message, title = "Partida Atual") {
    if (times.length == 0) {
        message.reply('Times não sorteados.');
        return;
    }

    let time1 = times[partidaAtual[0]];
    let time2 = times[partidaAtual[1]];

    let mensagem = `${title}:\n\n`;
    mensagem += `Partida ${proximaPartidaIndex} - Time ${partidaAtual[0] + 1} vs Time ${partidaAtual[1] + 1}:\n`;
    mensagem += `${formatarJogadores(time1)} \n\n vs \n\n ${formatarJogadores(time2)}\n\n`;
    message.reply(mensagem);

}

// Função para registrar a derrota de um time e reordenar a lista de times
function handleTeamLost(message, teamNumber) {

    if (partidaAtual.length == 0) {
        message.reply('não existe partida em andamento.');
        return;
    }
    if (!partidaAtual.includes(teamNumber - 1)) {
        message.reply('O time informado não se encotra na partida atual');
        return;
    }

    let perderdor = times[teamNumber - 1];
    loser = teamNumber - 1;

    let vencedor = partidaAtual.find(time => time != loser);
    partidaAtual = [vencedor];

    perderdor.forEach(player => {
        handleAddPlayerToLastTeam(player)
    });

    // message.reply(`O Time ${teamNumber} foi movido para o final da lista. Jogadores foram redistribuídos.`);
    // handleShowTeams(message);
    handleNextMatch(message);
}

//adiciona um jogador a lista
async function handleAddPlayer(message, player) {
    if (!await isAdmin()) {
        message.reply('Apenas o administrador do grupo pode adicionar jogadores livremente.');
        return;
    }
    confirmados.push(player);
    if (times.length > 0) {
        handleAddPlayerToLastTeam(player);
        handleShowTeams(message);
        return;
    }
    handleShowList(message);
}

//remove um jogador da lista
async function handleRemovePlayer(message, player) {
    if (!await isAdmin()) {
        message.reply('Apenas o administrador do grupo pode remover jogadores livremente.');
        return;
    }
    if (times.length > 0) {
        removePlayerFromTeams(player);
        handleShowTeams(message);
        return;
    } else {
        handleLeaveList(message, player);
    }
}

function removePlayerFromTeams(player) {
    times = times.map((time, index) => {
        if (proximoTimeIndex <= index || partidaAtual.includes(index)) {
            const i = time.findIndex(p => p.toLowerCase().trim() == player.toLowerCase().trim());
            if (i !== -1) {
                time.splice(i, 1);
            }
        }
        return time;
    });
    handleReorderTimes();
}

//adiciona um jogador ao final dos times
function handleAddPlayerToLastTeam(player) {
    let ultimoTime = times[times.length - 1];
    if (ultimoTime.length < 5) {
        ultimoTime.push(player);
    } else {
        times.push([player])
    }
}

function handleReorderTimes() {
    const maxPlayers = 5;
    for (let i = 0; i < times.length - 1; i++) {
        while (times[i].length < maxPlayers && times[i + 1].length > 0) {
            let proximoTime = times[i + 1];
            let indexTime = i + 1;
            while (partidaAtual.includes(indexTime)) {
                indexTime++;
                proximoTime = times[indexTime];
            }
            times[i].push(proximoTime.shift());
        }
    }
    // Remove empty arrays
    times = times.filter(subArray => subArray.length > 0);

}

// Função para exibir a lista de comandos disponíveis
function handleHelp(message) {
    let resposta = `*📋 Lista de comandos disponíveis:*\n\n`;
    resposta += `- *${COMMAND_ENTER}*: _Para entrar na lista de confirmados._ ✅\n`;
    resposta += `- *${COMMAND_CANCEL}*: _Para cancelar o jogo de futebol._ ❌\n`;
    resposta += `- *${COMMAND_OPEN}*: _Para abrir a lista para adições._ 📂\n`;
    resposta += `- *${COMMAND_LEAVE}*: _Para sair da lista de confirmados._ 🚪\n`;
    resposta += `- *${COMMAND_DRAW}*: _Para sortear os times._ 🎲\n`;
    resposta += `- *${COMMAND_NEXT}*: _Para ver a próxima partida na sequência._ ⏭️\n`;
    resposta += `- *${COMMAND_HELP}*: _Para ver esta lista de comandos novamente._ 🆘\n`;
    resposta += `- *${COMMAND_SHOW_TEAMS}*: _Para ver os times sorteados._ 👥\n`;
    resposta += `- *${COMMAND_CURRENT_MATCH}*: Para ver a partida atual._ ⚽\n`;

    message.reply(resposta);


}

// Função para formatar a lista de confirmados
function formatarListaConfirmados() {
    let lista = `*FUTEBOL DE TERÇA* ⚽\n\n`;
    lista += ` 📍Local: Tiba Sport Center\n\n`;
    lista += ` 🗓️ Data: ${obterDataProximaTerca()}\n\n`;
    lista += ` Nível: Amador\n\n`;
    lista += ` 🕰️ Horário: 21:00 as 20:00 (PODENDO SER ESTENDIDO)\n\n`;
    lista += ` ⏳ Duração: 1 hora\n\n`;
    lista += ` 🤑 PIX: Luiz: luizmarcelo258@gmail.com\n\n`;
    lista += ` 🥅 PARTIU, JOGAR!!! \n\n`;

    lista += ` *Lista de atletas:* \n\n`;

    confirmados.forEach((nome, index) => {
        if ((index + 1) == 18) {
            lista += `\n\n **Lista de espera:** \n\n`;
        }
        lista += `${index + 1} - ${nome}\n`;
    });
    return lista;
}

// Função para obter a data da próxima terça-feira
function obterDataProximaTerca() {
    let hoje = new Date();
    let proximaTerca = new Date(hoje);
    proximaTerca.setDate(hoje.getDate() + ((2 - hoje.getDay() + 7) % 7) + 1); // Calcula a próxima terça-feira
    return proximaTerca.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Função para sortear os jogadores em times
function sortearTimes() {
    if (confirmados.length < 10) {
        return 'Não há jogadores suficientes para formar times.';
    }
    let cloneConfirmados = [...confirmados];
    let jogadoresEmbaralhados = cloneConfirmados.sort(() => Math.random() - 0.5);
    let numeroTimes = Math.ceil(confirmados.length / 5);
    times = [];

    for (let i = 0; i < numeroTimes; i++) {
        let time = jogadoresEmbaralhados.slice(i * 5, (i + 1) * 5);
        times.push(time);
    }

    let mensagem = 'Times sorteados:\n\n';
    times.forEach((time, index) => {
        mensagem += `Time ${index + 1}:\n`;
        time.forEach((jogador, idx) => {
            mensagem += `${idx + 1} - ${jogador}\n`;
        });
        mensagem += '\n';
    });

    return mensagem;
}

// Função para formatar os jogadores de um time
function formatarJogadores(time) {
    return time.map((jogador, idx) => `${idx + 1} - ${jogador}`).join('\n');
}

// Inicializar o cliente
client.initialize();
