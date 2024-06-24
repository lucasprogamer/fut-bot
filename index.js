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
const specificGroup = 'Futebol das Terças ⚽';
// const specificGroup = 'Lolzim - Bora marcar';

// Variáveis para gerenciar os confirmedPlayers e o jogo
let confirmedPlayers = [
];
let listOpen = false;
let chat = null;
let contact = null;

// Limite máximo de pessoas na lista
const maxPlayers = 23;
const maxPlayerForTeam = 5;

// Variáveis para gerenciar os teams e a rotação
let teams = []; // Array para armazenar os teams
let nextTeamIndex = 0; // Índice do próximo time na sequência
let nextMatchIndex = 0; // Índice da próxima partida na sequência
let currentMatch = [];

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
// Função para adicionar um jogador à lista de confirmedPlayers
function handleEnterList(message) {
    if (!listOpen) {
        message.reply('A lista não está aberta para adições no momento.');
        return;
    }

    if (currentMatch.length > 0) {
        message.reply('As partidas já estão em andamento solicite ao administrador para entrar na lista.');
        return;
    }

    if (confirmedPlayers.length >= maxPlayers) {
        message.reply(`Desculpe, já atingimos o número máximo de ${maxPlayers} pessoas na lista.`);
        return;
    }

    const contactName = message.rawData.notifyName;
    if (!confirmedPlayers.includes(contactName)) {
        confirmedPlayers.push(contactName);
    }

    message.reply(formatPlayersList());
}

// Função para exibir a lista de confirmedPlayers
function handleShowList(message) {
    message.reply(formatPlayersList());
}

// Função para abrir a lista de confirmedPlayers
async function handleOpenList(message) {
    if (!await isAdmin()) {
        message.reply('Apenas o administrador do grupo pode abrir e fechar a lista.');
        return;
    }

    listOpen = true;
    message.reply('A lista está aberta para adições. Envie "entrar na lista" para se adicionar.');

}

// Função para remover um jogador da lista de confirmedPlayers
function handleLeaveList(message, player = null) {
    if (!player) {
        player = message.rawData.notifyName;
    }
    const index = confirmedPlayers.findIndex(p => p.toLowerCase().trim() == player.toLowerCase().trim());
    if (index !== -1) {
        confirmedPlayers.splice(index, 1);
        message.reply(formatPlayersList());
    } else {
        message.reply(`Jogador não está na lista de confirmados.`);
    }
}

// Função para sortear os teams
async function handleDrawTeams(message) {
    if (!await isAdmin()) {
        message.reply('Apenas o administrador do grupo pode sortear os times.');
        return;
    }
    const messageTeams = suffleTeams();
    message.reply(messageTeams);
}

// Função para mostrar os teams sorteados
function handleShowTeams(message) {
    if (teams.length === 0) {
        message.reply('Os times ainda não foram sorteados.');
    } else {
        let response = 'Times sorteados:\n\n';
        teams.forEach((time, index) => {
            response += `Time ${index + 1}:\n`;
            time.forEach((jogador, idx) => {
                response += `${idx + 1} - ${jogador}\n`;
            });
            response += '\n';
        });
        message.reply(response);
    }
}

// Função para responder à próxima partida na sequência
function handleNextMatch(message) {
    if (loser == null && currentMatch.length > 0) {
        message.reply('perdedor não informado.');
        return;
    }
    if (teams.length == 0) {
        message.reply('Os times ainda não foram sorteados.');
        return;
    }

    let team1 = teams[nextTeamIndex];
    let team2 = teams[(nextTeamIndex + 1) % teams.length];
    if (loser) {
        team1 = teams[currentMatch[0]];
        team2 = teams[nextTeamIndex + 1];
        currentMatch = [currentMatch[0], nextTeamIndex + 1];
    } else {
        currentMatch = [nextTeamIndex, nextTeamIndex + 1];
    }

    let messageText = `Próxima partida:\n\n`;
    messageText += `🏟️ *Partida ${nextMatchIndex + 1} * \n *Time ${currentMatch[0] + 1}*\n`;
    messageText += `${formatPlayersResponse(team1)} \n\n vs  \n *Time ${currentMatch[1] + 1}* \n\n ${formatPlayersResponse(team2)}\n\n`;

    if (loser == null) {
        nextTeamIndex = (nextTeamIndex + 1) % teams.length;
    } else {
        loser = null;
        nextTeamIndex++;
    }

    nextMatchIndex++;
    message.reply(messageText);
}

// define que ouve empate
function handleMatchDraw(message) {
    if (teams.length == 0) {
        message.reply('Os times ainda não foram sorteados.');
        return;
    }

    if (currentMatch.length == 0) {
        message.reply('Nenhuma partida encontrada.');
        return;
    }
    currentMatch = [];
    loser = null;
    nextTeamIndex++;
    handleNextMatch(message);
}

//exibe a partida atual
function handleShowCurrentMatch(message, title = "Partida Atual") {
    if (teams.length == 0) {
        message.reply('Times não sorteados.');
        return;
    }

    if (currentMatch.length == 0) {
        message.reply('Nenhuma partida em andamento.');
        return;
    }

    let team1 = teams[currentMatch[0]];
    let team2 = teams[currentMatch[1]];

    let messageText = `${title}:\n\n`;
    messageText += `🏟️ Partida ${nextMatchIndex} - Time ${currentMatch[0] + 1} vs Time ${currentMatch[1] + 1}\n\n`;
    messageText += `*Time ${currentMatch[0] + 1}*\n`;
    messageText += formatPlayersResponse(team1);
    messageText += `\n\n vs \n\n*Time ${currentMatch[1] + 1}*\n`;
    messageText += formatPlayersResponse(team2);

    message.reply(messageText);
}


// Função para registrar a derrota de um time e reordenar a lista de teams
function handleTeamLost(message, teamNumber) {

    if (currentMatch.length == 0) {
        message.reply('não existe partida em andamento.');
        return;
    }
    if (!currentMatch.includes(teamNumber - 1)) {
        message.reply('O time informado não se encotra na partida atual');
        return;
    }

    let perderdor = teams[teamNumber - 1];
    loser = teamNumber - 1;

    let vencedor = currentMatch.find(time => time != loser);
    currentMatch = [vencedor];

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
    confirmedPlayers.push(player);
    if (teams.length > 0) {
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
    if (teams.length > 0) {
        removePlayerFromTeams(player);
        handleShowTeams(message);
        return;
    } else {
        handleLeaveList(message, player);
    }
}

function removePlayerFromTeams(player) {
    teams = teams.map((team, index) => {
        if (nextTeamIndex <= index || currentMatch.includes(index)) {
            const i = team.findIndex(p => p.toLowerCase().trim() == player.toLowerCase().trim());
            if (i !== -1) {
                team.splice(i, 1);
            }
        }
        return team;
    });
    handleRearrangeTeams();
}

//adiciona um jogador ao final dos teams
function handleAddPlayerToLastTeam(player) {
    let lastTeam = teams[teams.length - 1];
    if (lastTeam.length < 5) {
        lastTeam.push(player);
    } else {
        teams.push([player])
    }
}

function handleRearrangeTeams(Teams) {
    for (let i = 0; i < teams.length - 1; i++) {
        while (teams[i].length < maxPlayerForTeam && teams[i + 1].length > 0) {
            let nextTeam = teams[i + 1];
            let teamIndex = i + 1;
            while (currentMatch.includes(teamIndex)) {
                teamIndex++;
                nextTeam = teams[teamIndex];
            }
            teams[i].push(nextTeam.shift());
        }
    }
    // Remove empty arrays
    teams = teams.filter(a => a.length > 0);

}

// Função para exibir a lista de comandos disponíveis
function handleHelp(message) {
    let response = `*📋 Lista de comandos disponíveis:*\n\n`;
    response += `- *${COMMAND_ENTER}*: _Para entrar na lista de confirmados._ ✅\n`;
    response += `- *${COMMAND_OPEN}*: _Para abrir a lista para adições._ 📂\n`;
    response += `- *${COMMAND_LEAVE}*: _Para sair da lista de confirmados._ 🚪\n`;
    response += `- *${COMMAND_DRAW}*: _Para sortear os teams._ 🎲\n`;
    response += `- *${COMMAND_NEXT}*: _Para ver a próxima partida na sequência._ ⏭️\n`;
    response += `- *${COMMAND_HELP}*: _Para ver esta lista de comandos novamente._ 🆘\n`;
    response += `- *${COMMAND_SHOW_TEAMS}*: _Para ver os teams sorteados._ 👥\n`;
    response += `- *${COMMAND_CURRENT_MATCH}*: Para ver a partida atual._ ⚽\n`;

    message.reply(response);


}

// Função para formatar a lista de confirmados
function formatPlayersList() {
    let response = `*FUTEBOL DE TERÇA* ⚽\n\n`;
    response += ` 📍Local: Tiba Sport Center\n\n`;
    response += ` 🗓️ Data: ${nextWeekDay()}\n\n`;
    response += ` Nível: Amador\n\n`;
    response += ` 🕰️ Horário: 21:00 as 20:00 (PODENDO SER ESTENDIDO)\n\n`;
    response += ` ⏳ Duração: 1 hora\n\n`;
    response += ` 🤑 PIX: Luiz: luizmarcelo258@gmail.com\n\n`;
    response += ` 🥅 PARTIU, JOGAR!!! \n\n`;

    response += ` *Lista de atletas:* \n\n`;

    confirmedPlayers.forEach((name, index) => {
        if ((index + 1) == 18) {
            response += `\n\n **Lista de espera:** \n\n`;
        }
        response += `${index + 1} - ${name}\n`;
    });
    return response;
}

// Função para obter a data da próxima terça-feira
function nextWeekDay() {
    let today = new Date();
    let nextDay = new Date(today);
    nextDay.setDate(today.getDate() + ((2 - today.getDay() + 7) % 7) + 1); // Calcula a próxima terça-feira
    return nextDay.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Função para sortear os jogadores em teams
function suffleTeams() {
    if (confirmedPlayers.length < 10) {
        return 'Não há jogadores suficientes para formar times.';
    }
    let cloneconfirmedPlayers = [...confirmedPlayers];
    let jogadoresEmbaralhados = cloneconfirmedPlayers.sort(() => Math.random() - 0.5);
    let numeroteams = Math.ceil(confirmedPlayers.length / 5);
    teams = [];

    for (let i = 0; i < numeroteams; i++) {
        let time = jogadoresEmbaralhados.slice(i * 5, (i + 1) * 5);
        teams.push(time);
    }

    let response = 'teams sorteados:\n\n';
    teams.forEach((time, index) => {
        response += `Time ${index + 1}:\n`;
        time.forEach((jogador, idx) => {
            response += `${idx + 1} - ${jogador}\n`;
        });
        response += '\n';
    });

    return response;
}

// Função para formatar os jogadores de um time
function formatPlayersResponse(team) {
    return team.map((player, idx) => `${idx + 1} - ${player}`).join('\n');
}

// Inicializar o cliente
client.initialize();
