if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log(err));
}

// --- SOUND ENGINE (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.15);
        gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'hit') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(20, now + 0.3);
        gain.gain.setValueAtTime(0.5, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'heal') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'click') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(700, now);
        gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    }
}

// --- ERZÄHLER ENGINE ---
let voiceEnabled = true;
function toggleVoice() {
    voiceEnabled = !voiceEnabled;
    document.getElementById("voice-btn").innerText = voiceEnabled ? "🔊 Erzähler: AN" : "🔇 Erzähler: AUS";
    if (!voiceEnabled) window.speechSynthesis.cancel();
}

function speak(text) {
    if (!voiceEnabled) return;
    window.speechSynthesis.cancel(); // Vorherige Sprachausgabe stoppen
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 1.0; 
    window.speechSynthesis.speak(utterance);
}

// --- SPIEL-ZUSTAND ---
let playerState = { hp: 100, ammo: 5, hasMedkit: true, currentLocation: "landungsboot" };

function logMessage(msg) {
    document.getElementById("combat-log").innerText = ">> " + msg;
}

// --- STORY DATENBANK (14 Stationen, 30 Minuten Content) ---
const storyData = {
    landungsboot: {
        text: "Missionsphase 1: Ärmelkanal. Du stehst in einem schwankenden Landungsboot vor der Normandie. Das Wasser schlägt dir ins Gesicht. Gleich fällt die Rampe. Mach dich bereit, Soldat.",
        location: "Vor der Normandie - 06:25 Uhr",
        choices: [
            { text: "[Sturm] Sofort nach dem Öffnen ins Wasser springen", action: () => rollDice(0.6, "Infanteriefeuer knapp entgangen!", "Eine Welle reißt dich mit! (-20 HP)", 20, "omaha_strand") },
            { text: "[Warten] Eine Sekunde Deckung hinter der Bootswand suchen", action: () => rollDice(0.4, "Die erste Salve zieht vorbei.", "Ein Querschläger trifft dich! (-30 HP)", 30, "omaha_strand") }
        ]
    },
    omaha_strand: {
        text: "Missionsphase 2: Omaha Beach. Totales Chaos am Strand. Überall Detonationen und heftiges Maschinengewehrfeuer aus den Klippen. Du musst vorrücken.",
        location: "Omaha Beach",
        choices: [
            { text: "[Sprint] Offenes Feld zur nächsten Panzersperre überqueren", action: () => rollDice(0.5, "Sicher an der Sperre angekommen.", "In den Oberschenkel getroffen! (-40 HP)", 40, "klippen_bunker") },
            { text: "[Kriechen] Hinter einem brennenden Panzer Wrack Schutz suchen", action: () => rollDice(0.7, "Langsam aber sicher vorgerückt.", "Artillerie-Einschlag schleudert dich weg! (-25 HP)", 25, "klippen_bunker") }
        ]
    },
    klippen_bunker: {
        text: "Missionsphase 3: Der Bunkerkomplex. Du stehst direkt unterhalb des Grabensystems. Eine Sprengladung muss am Stacheldraht platziert werden.",
        location: "Widerstandsnest 62",
        choices: [
            { text: "[Sprengung] Bangalore-Ladung scharfmachen und zünden", action: () => rollDice(0.8, "Der Draht ist weggesprengt! Wir stürmen!", "Frühzeitige Detonation verletzt dich! (-30 HP)", 30, "heckenkrieg") }
        ]
    },
    heckenkrieg: {
        text: "Missionsphase 4: Das Heckenland. Die Normandie überrascht euch mit unübersichtlichen Büschen. Ein versteckter Scharfschütze hält deine Gruppe fest.",
        location: "Normandie - Heckenland",
        choices: [
            { text: "[Flanke] Durch das dichte Unterholz kriechen", action: () => rollDice(0.6, "Schütze umgangen und ausgeschaltet. Munition gefunden! (+1 Ammo)", "Du läufst direkt in eine Stolperdraht-Mine! (-35 HP)", 35, "st_lo") }
        ]
    },
    st_lo: {
        text: "Missionsphase 5: Saint-Lô. Die Stadt liegt in Trümmern. Alliierte Bomber fliegen Angriffe, während am Boden ein unerbittlicher Häuserkampf tobt.",
        location: "Ausläufer von Saint-Lô",
        choices: [
            { text: "[Feuerkampf] MG-Nest mit Sturmgewehr bekämpfen (-1 Ammo)", action: () => useAmmo("Feuerkampf erfolgreich. Weg frei!", "st_lo_innen") },
            { text: "[Nahkampf] Durch den Keller einschleichen", action: () => rollDice(0.5, "Überraschungseffekt genutzt.", "Der Feind hat den Keller vermint! (-40 HP)", 40, "st_lo_innen") }
        ]
    },
    st_lo_innen: {
        text: "Missionsphase 6: Saint-Lô Zentrum. Der Durchbruch durch die Verteidigungslinien gelingt. Die Fahrzeuge werden für den Marsch nach Osten bereitgemacht.",
        location: "Saint-Lô - Marktplatz",
        choices: [
            { text: "[Vorrücken] Auf die Lastwagen aufsitzen", next: "paris_befreiung" }
        ]
    },
    paris_befreiung: {
        text: "Missionsphase 7: Paris. Die französische Hauptstadt kämpft um ihre Freiheit. Du musst den Widerstand unterstützen, um eine strategische Brücke zu sichern.",
        location: "Paris - Seineufer",
        choices: [
            { text: "[Eile] Den Zünderdraht der Sprengladung kappen", action: () => rollDice(0.7, "Draht gekappt. Paris feiert die Befreiung!", "Zünder geht hoch, Brücke beschädigt! (-20 HP)", 20, "huertgenwald") }
        ]
    },
    huertgenwald: {
        text: "Missionsphase 8: Hürtgenwald. Die Hölle im dichten Wald. Artillerie zersprengt die Baumkronen und lässt tödliche Holzsplitter regnen.",
        location: "Hürtgenwald",
        choices: [
            { text: "[Bunker] In einen verlassenen Westwall-Bunker flüchten", action: () => rollDice(0.5, "Sichere Deckung im Betonbau gefunden.", "Der Bunker war feindbesetzt! Nahkampf! (-35 HP)", 35, "aachen_stadt") },
            { text: "[Schanzen] Eingraben und den Kopf einziehen", action: () => rollDice(0.6, "Die Splitter fliegen knapp über dich hinweg.", "Holzsplitter durchbohren deine Deckung! (-25 HP)", 25, "aachen_stadt") }
        ]
    },
    aachen_stadt: {
        text: "Missionsphase 9: Schlacht um Aachen. Die erste deutsche Großstadt wird belagert. Ein erbitterter Häuserkampf von Zimmer zu Zimmer entbrennt.",
        location: "Aachen - Innenstadt",
        choices: [
            { text: "[Schwere Waffe] Panzerfaust gegen Barrikade einsetzen (-1 Ammo)", action: () => useAmmo("Mauer durchbrochen, Stellung vernichtet.", "remagen_bruecke") },
            { text: "[Sturm] Die Stellung mit Bajonett stürmen", action: () => rollDice(0.4, "Feind zieht sich geschockt zurück.", "Schweres Gegenfeuer bricht euren Vormarsch! (-45 HP)", 45, "remagen_bruecke") }
        ]
    },
    remagen_bruecke: {
        text: "Missionsphase 10: Brücke von Remagen. Der Rhein liegt endlich vor euch. Der Feind versucht verzweifelt, den Übergang zu sprengen, während ihr angreift.",
        location: "Remagen - Ludendorff-Brücke",
        choices: [
            { text: "[Sprint] Nicht anhalten, unter Feuer über die Brücke rennen!", action: () => rollDice(0.55, "Drüben! Der Rhein ist erfolgreich überquert!", "Artillerietreffer wirft dich zu Boden! (-30 HP)", 30, "koeln_rand") }
        ]
    },
    koeln_rand: {
        text: "Missionsphase 11: Köln Außenbezirke. Der Kölner Dom ist in der Ferne sichtbar. Ein Scharfschütze riegelt die Hauptstraße ab.",
        location: "Köln - Lindenthal",
        choices: [
            { text: "[Umfassung] Durch das unterirdische Kanalsystem schleichen", action: () => rollDice(0.65, "Sicher hinter der Stellung aufgetaucht.", "Schlamm und Gase schwächen dich. (-15 HP)", 15, "koeln_dom") }
        ]
    },
    koeln_dom: {
        text: "Missionsphase 12: Der Domplatz. Überall Asche und Ruinen. Ein verbündeter Pershing-Panzer liefert sich ein Duell mit einem Panther-Panzer.",
        location: "Köln - Domplatz",
        choices: [
            { text: "[Taktik] Koordinaten per Funk an den Panzer melden", action: () => rollDice(0.75, "Volltreffer! Der gegnerische Panzer brennt aus.", "Trümmerteile verletzen dich im Feuersturm! (-20 HP)", 20, "koeln_nord") }
        ]
    },
    koeln_nord: {
        text: "Missionsphase 13: Vorstoß nach Norden. Die verbliebenen Verteidiger ziehen sich in die Wohngebiete zurück. Ihr setzt zur Verfolgung an.",
        location: "Köln - Nippes",
        choices: [
            { text: "[Angriff] Tempo erhöhen und Nachhut attackieren", action: () => rollDice(0.5, "Feindliche Nachhut erfolgreich überrascht.", "Ein plötzlicher Hinterhalt erwischt euch! (-30 HP)", 30, "heidemann_anflug") }
        ]
    },
    heidemann_anflug: {
        text: "Missionsphase 14: Einbiegen in die Heidemannstraße. Das finale Nest. Eine massive Barrikade blockiert die Kreuzung. Das ist das Ende des Weges.",
        location: "Köln - Heidemannstraße",
        choices: [
            { text: "[Finale] Den letzten, entscheidenden Vorstoß anführen!", action: () => eventFinalHeidemann() }
        ]
    },
    victory: {
        text: "Missionserfolg! Du stehst erschöpft in der Heidemannstraße. Die Waffen schweigen. Du hast dich vom Ärmelkanal bis ins Herz von Köln durchgekämpft. Der Krieg ist vorbei. Du fährst nach Hause.",
        location: "Heidemannstraße - Gesichert",
        choices: [{ text: "Neue Kampagne starten", action: () => restartGame() }]
    },
    game_over: {
        text: "Im Einsatz gefallen. Deine Reise endet hier im Staub der Geschichte. Der Feldzug ist gescheitert.",
        location: "KIA - Gefallen",
        choices: [{ text: "Es noch einmal versuchen", action: () => restartGame() }]
    }
};

// --- LOGIK UND SYSTEM-FUNKTIONEN ---
function rollDice(successChance, successMsg, failMsg, damage, nextLocation) {
    if (Math.random() <= successChance) {
        logMessage(successMsg);
        loadStory(nextLocation);
    } else {
        playSound('hit');
        playerState.hp -= damage;
        logMessage(failMsg);
        checkHealth(nextLocation);
    }
}

function useAmmo(successMsg, nextLocation) {
    if (playerState.ammo > 0) {
        playerState.ammo--;
        playSound('shoot');
        logMessage(successMsg);
        loadStory(nextLocation);
    } else {
        logMessage("Keine Munition! Du musstest ungeschützt stürmen!");
        playSound('hit');
        playerState.hp -= 40;
        checkHealth(nextLocation);
    }
}

function eventFinalHeidemann() {
    playSound('shoot');
    let score = (playerState.hp / 20) + playerState.ammo;
    if (score >= 4 || Math.random() > 0.4) {
        loadStory("victory");
    } else {
        playSound('hit');
        loadStory("game_over");
    }
}

function checkHealth(nextStep) {
    if (playerState.hp <= 0) {
        if (playerState.hasMedkit) {
            playSound('heal');
            playerState.hp = 45;
            playerState.hasMedkit = false;
            logMessage("SANIDÄTER! Das Medkit rettet dich! (+45 HP)");
            updateHUD();
            loadStory(nextStep);
        } else {
            loadStory("game_over");
        }
    } else {
        updateHUD();
        loadStory(nextStep);
    }
}

function updateHUD() {
    document.getElementById("hp-bar").style.width = playerState.hp + "%";
    document.getElementById("ammo-display").innerText = `AMMO: ${playerState.ammo} | MED: ${playerState.hasMedkit ? 1 : 0}`;
}

function loadStory(nodeKey) {
    playerState.currentLocation = nodeKey;
    const node = storyData[nodeKey];
    
    document.getElementById("story-text").innerText = node.text;
    document.getElementById("location").innerText = node.location;
    updateHUD();
    
    // Erzähler liest den Text vor
    speak(node.text);
    
    const choicesContainer = document.getElementById("choices");
    choicesContainer.innerHTML = "";
    
    node.choices.forEach(choice => {
        const button = document.createElement("button");
        button.innerText = choice.text;
        button.classList.add("choice-btn");
        button.onclick = () => {
            playSound('click');
            if (choice.action) choice.action();
            else if (choice.next) loadStory(choice.next);
        };
        choicesContainer.appendChild(button);
    });
}

function restartGame() {
    playerState = { hp: 100, ammo: 5, hasMedkit: true, currentLocation: "landungsboot" };
    logMessage("Marschbefehl erteilt. Vorrücken!");
    loadStory("landungsboot");
}

restartGame();
