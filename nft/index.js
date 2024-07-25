const axios = require('axios');
const fs = require('fs');

const calckeyNotesUrl = "https://silly.rest/api/notes/create";
const calckeyDriveUploadUrl = "https://silly.rest/api/drive/files/upload-from-url";
const calckeyDriveFilesUrl = "https://silly.rest/api/drive/files";
const calckeyApiKey = ""; // this is ur api key bozo.. im not giving you mine
const nftApiBaseUrl = "https://my-cool-app.com/nft"; // the API endpoint to get your desired image goes here, im not giving out the API for the NFTs.
const searchTag = 'nft-please'; // please customize this tag to be different. :3
const processedIdsFile = 'processed_ids.txt';
const blacklistFile = 'blacklist.txt';

let processedIds = new Set(fs.existsSync(processedIdsFile) ? fs.readFileSync(processedIdsFile, 'utf8').split('\n').filter(Boolean) : []);
let blacklist = new Set(fs.existsSync(blacklistFile) ? fs.readFileSync(blacklistFile, 'utf8').split('\n').filter(Boolean) : []);

const validSeasons = [
    "default", "april", "autumn", "birthday", "christmas", "easter", "halloween",
    "newyear", "pride", "spring", "stpatricks", "summer", "valentines", "winter"
]; // This can be like, Cats or something. 

async function checkForNewNotes() {
    try {
        const response = await axios.post("https://silly.rest/api/notes/search-by-tag", { tag: searchTag }); // Using tags was the only smart way to currently make it listen for commands... Because note searching is disabled.
        const notes = response.data;

        for (const note of notes) {
            const noteId = note.id;
            const username = note.user.username.toLowerCase();

            if (blacklist.has(username) || processedIds.has(noteId)) continue;

            processedIds.add(noteId);
            fs.appendFileSync(processedIdsFile, `${noteId}\n`, 'utf8');
            await respondToNote(note);
        }
    } catch (error) {
        console.error(`Error fetching notes: ${error.message}`);
    }
}

async function respondToNote(note) {
    const noteId = note.id;
    const noteText = note.text.toLowerCase();
    const username = note.user.username.toLowerCase();

    if (noteText.includes('help')) {
        await sendHelpResponse(noteId);
    } else if (noteText.includes('blacklist') && ['proxyz', 'luke', 'nft', 'kazz'].includes(username)) { // your username goes in the brackets.
        blacklist.add(username);
        fs.appendFileSync(blacklistFile, `${username}\n`, 'utf8');
        await sendMessage(noteId, `@${note.user.username} has been blacklisted from using the bot.`);
    } else if (noteText.includes('unbl') && blacklist.has(username)) {
        blacklist.delete(username);
        fs.writeFileSync(blacklistFile, Array.from(blacklist).join('\n'), 'utf8');
        await sendMessage(noteId, `@${note.user.username} has been unblacklisted and can now use the bot.`);
    } else {
        await generateAndSendNFT(noteId, noteText);
    }
}

async function generateAndSendNFT(noteId, noteText) {
    try {
        const colorMatch = noteText.match(/c:([0-9a-fA-F]{6})/);
        const seasonMatch = noteText.match(/s:(\w+)/);
        
        const color = colorMatch ? colorMatch[1] : null;
        const season = seasonMatch && validSeasons.includes(seasonMatch[1]) ? seasonMatch[1] : null;

        let nftUrl = nftApiBaseUrl;
        if (color) {
            nftUrl += `/${color}`;
            if (season) {
                nftUrl += `/${season}`;
            }
        }

        const nftResponse = await axios.get(nftUrl);
        const nftData = nftResponse.data;
        const fileId = await uploadImageToDrive(nftData.image);
        
        if (fileId) {
            const noteData = {
                replyId: noteId,
                text: `Here's your NFT! Season: ${nftData.season}, Color: ${nftData.name} (${nftData.hex})`,
                fileIds: [fileId]
            };

            await axios.post(calckeyNotesUrl, noteData, {
                headers: {
                    "Authorization": `Bearer ${calckeyApiKey}`,
                    "Content-Type": "application/json"
                }
            });
        }
    } catch (error) {
        console.error(`Error generating or sending NFT: ${error.message}`);
    }
}

async function sendHelpResponse(noteId) {
    const helpText = `
To use the bot:
1. For a random NFT: #nft-please
2. For a specific color: #nft-please c:HEX (e.g., c:64cc04)
3. For a specific color and season: #nft-please c:HEX s:SEASON
You are NOT able to generate a specific season.
Available seasons: ${validSeasons.join(', ')}
`;

    await sendMessage(noteId, helpText);
}

async function sendMessage(noteId, text) {
    try {
        await axios.post(calckeyNotesUrl, { replyId: noteId, text }, {
            headers: {
                "Authorization": `Bearer ${calckeyApiKey}`,
                "Content-Type": "application/json"
            }
        });
    } catch (error) {
        console.error(`Error sending message: ${error.message}`);
    }
}

async function uploadImageToDrive(imageUrl) {
    try {
        const headers = {
            "Authorization": `Bearer ${calckeyApiKey}`,
            "Content-Type": "application/json"
        };

        await axios.post(calckeyDriveUploadUrl, { url: imageUrl }, { headers });
        await new Promise(resolve => setTimeout(resolve, 2500)); // this is a cooldown so we can find the image ID, DO NOT LOWER IT LOWER THAN 2500! If you have issues with uploading the image, Set this to somewhere between 2500 and 5000.

        const findResponse = await axios.post(calckeyDriveFilesUrl, { limit: 1 }, { headers });
        return findResponse.data[0]?.id || null;
    } catch (error) {
        console.error(`Error uploading image: ${error.message}`);
        return null;
    }
}

async function startBot() {
    console.log("Logged in!");
    while (true) {
        await checkForNewNotes();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Verified bots don't get ratelimited with a 1s wait. But i would suggest keeping this from 2500 to 15000. (This is in Milliseconds)
    }
}

process.on('SIGINT', () => {
    console.log("Shutting down gracefully...");
    process.exit();
});

startBot();
