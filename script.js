// BDD
const SUPABASE_URL = 'https://ggunnirdsnplfaytkcff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndW5uaXJkc25wbGZheXRrY2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA0NDI2NjgsImV4cCI6MjAzNjAxODY2OH0.mZpr2HTGVEWs_xt47Ffk80zAwpJWp-1Hu6iR96OJYUw';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var USERNAME = window.localStorage.getItem("username") || '';
var USERKEY = window.localStorage.getItem("userkey") || '';

const APIController = (function() {
    const nip = String.fromCharCode(56, 54, 100, 100, 102, 98, 49, 51, 55, 49, 102, 52, 52, 48, 50, 56, 56, 52, 56, 54, 102, 100, 56, 54, 100, 53, 53, 53, 51, 98, 54, 98);
    const tuc = String.fromCharCode(99, 56, 50, 53, 102, 55, 54, 97, 100, 54, 50, 101, 52, 97, 55, 101, 56, 98, 51, 52, 48, 54, 54, 48, 55, 56, 57, 53, 101, 101, 48, 97);

    // private methods
    const _getToken = async () => {

        const result = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type' : 'application/x-www-form-urlencoded', 
                'Authorization' : 'Basic ' + btoa(nip + ':' + tuc)
            },
            body: 'grant_type=client_credentials'
        });

        const data = await result.json();
        return data.access_token;
    }

    const _getPlaylist = async(token) => {
        const result = await fetch('https://api.spotify.com/v1/playlists/6MiBYhSbLxGXfNcc5ZzNj8?market=FR', {
            method: 'GET',
            headers: { 'Authorization' : 'Bearer ' + token}
        });
        const data = await result.json();
        return data.tracks;
    }

    const _getPlaylist2 = async(token) => {
        const result = await fetch('https://api.spotify.com/v1/playlists/7EMbtxrDS6DfnnQF89oise?market=FR', {
            method: 'GET',
            headers: { 'Authorization' : 'Bearer ' + token}
        });
        const data = await result.json();
        return data.tracks;
    }

    return {
        getToken() {
            return _getToken();
        },
        getPlaylist(token) {
            return _getPlaylist(token);
        },
        getPlaylist2(token) {
            return _getPlaylist2(token);
        }
    }
})();


// UI Module
const UIController = (function() {

    //object to hold references to html selectors
    const DOMElements = {
        hfToken: '#hidden_token',
    }

    //public methods
    return {
        
        storeToken(value) {
            document.querySelector(DOMElements.hfToken).value = value;
        },

        getStoredToken() {
            return {
                token: document.querySelector(DOMElements.hfToken).value
            }
        }
    }

})();

const APPController = (function(UICtrl, APICtrl) {    

    // GAME LOGIC
    const SHUFFLE = true;
    const DEVMODE = false;
    const PRODMODE = true;
    const DEFAULTANSWERSAMOUNT = 4;
    const DIFFICULTYNAMES = ['Normal', 'Difficile', 'Infernal', 'Extrême', 'Glitched'];
    var MINSTREAK = 3;
    var DEFAULTTRACKSBYGAME = 40;
    var TRACKSBYGAME = 40;
    var ANSWERSAMOUNT = 4;
    var DIFFICULTYLEVEL = 1;
    var DISPLAYTRACKSINFOS = true;
    var DEFAULTTRACKDURATION = 30;
    var HARDCOREMODETRACKDURATION = 5;
    var TRACKSTART = 0;
    var DISPLAYAVATARS = false;
    var POINTSBYANSWER = 1;
    var POINTSMULTIPLICATOR = 1;
    var streak = 0;
    var streakBonus = 0;
    var tracks = [];
    var isPlaying = false;
    var answers = [];
    var score = 0;
    var playedTracks = 0;
    var currentTrack = 0;
    var currentAudioTime = 0;
    var modifierRates = [.25, .33, .5, .66, .75, .87, 1, 1.25, 1.5, 2, 2.25, 2.5, 2.75, 3, 1];
    var segmentDurations1 = [.5, 1, 1.5, 2];
    var segmentDurations2 = [.5, 1];
    var currentSegmentDurations = [];
    var z = String.fromCharCode;
    var audioPlayer = document.getElementById("audio_player");
    var audioPlayerHardcore = document.getElementById("audio_player_hardcore");
    var jsAudioPlayer = $('.js-audio-player');
    var jsAudioPlayerHardcore = $('.js-audio-player-hardcore');
    var soundRight = new Audio('assets/right.m4a');
    soundRight.volume = 0.5;
    var soundWrong = new Audio('assets/wrong.m4a');
    // Data
    var playersData = [];
    var playersDataBuild = '';
    var tracksByPlayer = 0;
    var playersAmount = 0;
    var playerIndexes = [];
    getGameData().then(function(result) {
        playersData = result;
        playersDataBuild = JSON.parse(JSON.stringify(playersData));
        tracksByPlayer = Math.floor(TRACKSBYGAME / playersData.length);
        playersAmount = playersData.length;
        playerIndexes= [...Array(playersAmount).keys()];
        $('.js-nb-options').attr('max', playersAmount);
    });
    var setList = [];
    var tracksIndexes = [];
    var setListLength = 0;
    var minScore = 0;
    // Player data
    var playerData = {};

    function buildSetlist() {
        resetCountdownBar();

        if(SHUFFLE) {
            // Shuffle players tracks index
            for(player in playersDataBuild) {
                playersDataBuild[player][1] = shuffleArray(playersDataBuild[player][1]);
            }
            // Shuffle players
            playersDataBuild = shuffleArray(playersDataBuild);
            /*console.log(playersDataBuild);*/
        }

        // playerIndexes.pop();

        // Build setlist from players traks
        for(player in playersDataBuild) {

            if(DEVMODE) {
                // ALL TRACKS
                for(track in playersDataBuild[player][1])
                    setList.push([playersDataBuild[player][0], playersDataBuild[player][1][track]]);
            }
            else {
                // N TRACKS BY PLAYER
                for(let i=0; i<tracksByPlayer; i++) {
                    // var index = i;
                    // var trackIndex = playersDataBuild[player][1][index];
                    if(playersDataBuild[player][1].length == 0)
                        break;
                    addToSetlist(playersDataBuild[player]);
                }
            }
        }
        // Remainder tracks to fill setlist
        while(setList.length < TRACKSBYGAME && setList.length < tracks.length && playersDataBuild.length > 0) {
            playersDataBuild = shuffleArray(playersDataBuild);
            if(playersDataBuild[0][1].length == 0) {
                playersDataBuild.shift();
            }
            else {
                addToSetlist(playersDataBuild[0]);
            }
        }
        if(SHUFFLE) {
            setList = shuffleArray(setList);
        }
        setListLength = setList.length;
        TRACKSBYGAME = setListLength;
        $('.js-track-total').text(setListLength);
        minScore = setListLength - setListLength / 5;

        if(DIFFICULTYLEVEL >= 5)        
            currentSegmentDurations = segmentDurations1;
    }

    function addToSetlist(player) {
        var playerName = player[0];
        var trackIndex = player[1].pop();
        // Check if track is already in array (avoid having same track more than 1 time in case of track chosen by multiple players)
        if(tracksIndexes.includes(trackIndex)) {
            return;
            // trackIndex = player[1].pop();
        }
        tracksIndexes.push(trackIndex);
        var data = [playerName, trackIndex];
        setList.push(data);
    }

    // get playlist on page load
    const loadPlaylist = async () => {
        //get the token
        const token = await APICtrl.getToken();           
        //store the token onto the page
        UICtrl.storeToken(token);
        //get playlist
        var tracks1 = await APICtrl.getPlaylist(token);
        var tracks2 = await APICtrl.getPlaylist2(token);
        tracks = tracks1.items.concat(tracks2.items);
        if(DEVMODE) {
	        for(track of tracks) {
	            console.log(tracks.indexOf(track) + 1);
	            console.log(track.track.preview_url);
	            console.log(track.track.id);
                console.log('----------');
	        }
	    }
        // buildSetlist();
        /*console.log(tracks);*/
        // totalTracks = tracks.total;        
        getPlayerData().then(function(result) {
            if(result.id != null) {
                playerData = result;
                // Get current player tracks
                for(var playerIndex in playersData) {
                	var currentPlayer = playersData[playerIndex];
                	if(currentPlayer[2] == playerData.initials) {
                		playerData.tracks = currentPlayer[1];
                		break;
                	}
                }
                getScores().then(function(result) {
                    playerData.scores = result[0].scores || [];
                });
                $('.js-settings').addClass('visible');
                $('.js-bar-top').addClass('visible');
                $('.js-login').removeClass('visible');
            }
            $('#wrapper').addClass('initialized');
        });
    }

    $('.js-play-track').on('click', function() {
        buildSetlist();
        $('.js-wrapper').removeClass('game_ended');
        $('.js-settings').removeClass('visible');
        $('.js-wrapper').addClass('game_started');
        $('.js-score-wrapper').addClass('visible');
        playTrack();  
    });

    $('.js-replay-game').on('click', function() {
        resetGame();
        $('.js-wrapper').addClass('game_started');
        $('.js-score-wrapper').addClass('visible');
        playTrack();
    });

    $('.js-back-menu').on('click', function() {
        quitGame();
        $('.js-wrapper').removeClass('game_started');
        $('.js-settings').addClass('visible');
    });

    // Quit game
    $('.js-quit-game').on('click', function() {
        isPlaying = false;
        audioPlayer.pause();
        audioPlayerHardcore.pause();
        quitGame();
        $('.js-wrapper').removeClass('game_started');
        $('.js-settings').addClass('visible');
    });

    // Set amount of tracks by game
    $('.js-nb-tracks').on('keyup mouseup', function() {
        if(+$(this).val() < +$(this).attr('min'))
            $(this).val($(this).attr('min'));
        TRACKSBYGAME = +$(this).val();
        tracksByPlayer = Math.floor(TRACKSBYGAME / playersData.length);
    });

    // Set difficulty level
    $('.js-input-difficulty').on('change', function() {
        var difficultyName = $(this).find('+ label .text_no_glitch').text();
        DIFFICULTYLEVEL = $(this).val();
        POINTSMULTIPLICATOR = DIFFICULTYLEVEL;
        $('.js-difficulty').text(difficultyName);
        $('.js-difficulty').attr('data-difficulty', DIFFICULTYLEVEL);
        $('.js-difficulty-details').removeClass('visible');
        $('.js-difficulty-details-' + DIFFICULTYLEVEL).addClass('visible');
        $('.js-multiplicator').text(POINTSMULTIPLICATOR);
        $('.js-multiplicator-wrapper').attr('data-value', POINTSMULTIPLICATOR);

        // Display infos
        DISPLAYTRACKSINFOS = DIFFICULTYLEVEL == 1;
        if(DISPLAYTRACKSINFOS) {
            $('.js-track-cover').removeClass('hidden');
        }
        else {
            $('.js-track-cover').addClass('hidden');
        }

        // Display like button
        $('.js-like-button').toggleClass('visually_hidden', DIFFICULTYLEVEL > 2);

        // Answers display
        DISPLAYAVATARS = DIFFICULTYLEVEL >= 4;

        // Answers amount
        ANSWERSAMOUNT = DIFFICULTYLEVEL >= 4 ? 8 : 4;

        // Audioplayer volume
        audioPlayer.volume = DIFFICULTYLEVEL < 5 ? 1 : 0;
        audioPlayerHardcore.volume = DIFFICULTYLEVEL < 5 ? 0 : 1;

        $('body').toggleClass('glitched', DIFFICULTYLEVEL == 5);
    });

    const playTrack = async () => {
        // Reset board        
        $('.js-answer').removeClass('correct');
        $('.js-answer').removeClass('incorrect');
        // Update track number
        playedTracks += 1;
        updateTrackNumber();
        // Track indexes
        var currentData = setList.shift();
        var index0 = currentData[1];
        var index = index0 + 1;
        currentTrack = index0;
        index = index < 10 ? "000" + index : index < 100 ? "00" + index : index < 1000 ? "0" + index: index;
        // Like button
        setLikeButton(index0);
        // Track preview
        var trackPreview = "assets/previews/" + index + ".m4a";        
        jsAudioPlayer.attr('src', trackPreview);
        jsAudioPlayerHardcore.attr('src', trackPreview);
        // Display track infos only if setting is set to true
        if(DISPLAYTRACKSINFOS) {
            // Track image
            var image = tracks[index0].track.album.images[1].url;
            $('.js-cover').attr('src', image);
            // Track name
            var name = tracks[index0].track.name;
            $('.js-name').text(name);
            // Track artists
            var artists = tracks[index0].track.artists;
            var artistsText = "";
            for(artist in artists) {
                artistsText += artists[artist].name + ", ";
            }
            artistsText = artistsText.slice(0, -2);
            $('.js-artist').text(artistsText);
        }
        else {
            // Track name
            $('.js-name').text('Morceau mystère');
            $('.js-artist').text('Artiste inconnu');
        }
        // Set first answer
        answers = [[currentData[0], true]];    
        // Shuffle players indexes    
        playerIndexes = shuffleArray(playerIndexes);
        // Set false answers
        var counter = 0;
        while(answers.length < ANSWERSAMOUNT && counter < playersAmount) {
            var currentName = playersData[playerIndexes[counter]][0];
            // Don't display other players that also chose current song to avoid confusion
            if(currentName != currentData[0] && !playersData[playerIndexes[counter]][1].includes (index0)) {
                answers.push([currentName, false]);
            }
            counter += 1;
        }
        // Shuffle answers
        answers = shuffleArray(answers);
        // Display answers
        $('.js-answers').empty();
        for(i=0; i<answers.length; i++) {
            var answerElem = '';
            var avatarSuffix = '';
            if(DIFFICULTYLEVEL >= 5) {
                // Display level 1 glitched avatar randomly
                // The more the game progresses, the more likely avatars will be glitched
                var percent = playedTracks <= 1 ? 0 : Math.floor((playedTracks-1) / (TRACKSBYGAME/2) * 100);
                var rand = Math.floor(Math.random() * 100 + 1);
                if(rand <= percent) {
                    avatarSuffix = '-glitched';
                    // display level 2 avatar if second half of the game has been reached
                    if(playedTracks > TRACKSBYGAME/2) {
                        var percent2 = Math.floor((playedTracks-(TRACKSBYGAME/2)-1) / (TRACKSBYGAME/2) * 100);
                        var rand2 = Math.floor(Math.random() * 100);
                        if(rand2 <= percent2)
                            avatarSuffix = '-glitched2';
                    }
                }
            }
            if(DISPLAYAVATARS)
                answerElem = $('<li class="list_answers__item list_answers__item--avatar"><button class="list_answers__avatar js-answer" data-index="' + i + '"><img class="list_answers__img" src="assets/avatars/' + answers[i][0].toLowerCase() + avatarSuffix + '.png"/></button></li>');
            else
                answerElem = $('<li class="list_answers__item"><button class="list_answers__name js-answer" data-index="' + i + '">' + answers[i][0] + '</button></li>');
            $('.js-answers').append(answerElem);
            if(DIFFICULTYLEVEL == 5) {
                document.body.style.setProperty('--glitchedOpacity', playedTracks/(TRACKSBYGAME-1));
                $('body').toggleClass('glitched_halfgame', playedTracks > TRACKSBYGAME/2);
            }

        }
        // Countdown
        $('.js-countdown').text(DIFFICULTYLEVEL <= 2 ? DEFAULTTRACKDURATION : HARDCOREMODETRACKDURATION);
        // Play track
        if(DIFFICULTYLEVEL >= 5) {
            currentAudioTime = Math.floor(Math.random() * 29);
            audioPlayerHardcore.currentTime = currentAudioTime;
            audioPlayerHardcore.playbackRate = setPlaybackRate();
        }
        if(DIFFICULTYLEVEL >= 3) {
            TRACKSTART = Math.floor(Math.random() * 24 + 1);
            audioPlayer.currentTime = TRACKSTART;
        }
        window.requestAnimationFrame(audioCountdown);
        audioPlayer.play();
        if(DIFFICULTYLEVEL >= 5)
            audioPlayerHardcore.play();
        isPlaying = true;        
        $('.js-answers').addClass('playing');
    }

    $('body').on('click', '.js-answer', function() {
        var that = $(this);
        if(!isPlaying)
            return;
        isPlaying = false;
        audioPlayer.pause();
        audioPlayerHardcore.pause();
        $('.js-answers').removeClass('playing');
        var answerIndex = that.attr('data-index');
        var [name, result] = answers[answerIndex];
        // Countdown
        var currentDuration = DIFFICULTYLEVEL <= 2 ? DEFAULTTRACKDURATION : HARDCOREMODETRACKDURATION;
        var currentCoundtown = DIFFICULTYLEVEL <= 2 ? DEFAULTTRACKDURATION - audioPlayer.currentTime : TRACKSTART + HARDCOREMODETRACKDURATION - audioPlayer.currentTime;
        var countdownPercentage = currentCoundtown / currentDuration * 100;
        resetCountdownBar(countdownPercentage + '%', 0);
        if(result) {
            that.addClass('correct');
            playSound(soundRight);
            streak += 1;
            streakBonus = streak - MINSTREAK >= 0 ? streak - MINSTREAK + 1 : 0;
            var scoreIncrement = (POINTSBYANSWER + streakBonus) * POINTSMULTIPLICATOR;
            score += scoreIncrement;
            if(streakBonus > 0)
                $('.js-streak-wrapper').addClass('active');
            $('.js-streak').text(streakBonus > 0 ? streakBonus : '');
            updateScore(POINTSBYANSWER * POINTSMULTIPLICATOR);
            if(!DIFFICULTYNAMES[DIFFICULTYLEVEL-1] in playerData.good_answers || playerData.good_answers[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] == null)
                playerData.good_answers[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] = 0;      
        	playerData.good_answers[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] += 1;
        }
        else {
            if(PRODMODE)
                updateAssignedTracks(name, currentTrack);
            playSound(soundWrong);
            that.addClass('incorrect');
            if(!DIFFICULTYNAMES[DIFFICULTYLEVEL-1] in playerData.wrong_answers || playerData.wrong_answers[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] == null)
                playerData.wrong_answers[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] = 0; 
        	playerData.wrong_answers[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] += 1;
            resetStreak();
        }
        nextTrack();
    });

    // Like track
    $(document).on('click', '.js-like-track', function() {
        var currentState = $(this).attr('data-liked') == 'true';
        var trackIndex = $(this).attr('data-index');
        var activeTrack = typeof trackIndex !== 'undefined' && trackIndex !== false ? parseInt(trackIndex) : currentTrack;
        if(!currentState)
            playerData.likedTracks.push(activeTrack);
        else
            playerData.likedTracks.splice(playerData.likedTracks.indexOf(activeTrack), 1);
        updateLikedTracks(playerData.likedTracks);
        $(this).attr('data-liked', !currentState);

    });

    jsAudioPlayer.on('timeupdate', function(event) {
        if((DIFFICULTYLEVEL >= 3  && audioPlayer.currentTime >= TRACKSTART + HARDCOREMODETRACKDURATION)
         || DIFFICULTYLEVEL <= 2 && audioPlayer.currentTime >= audioPlayer.duration) {
            $('.js-countdown').text(0);
            isPlaying = false;
            audioPlayer.pause();
            audioPlayerHardcore.pause();
            audioPlayer.currentTime = 0;
            $('.js-answers').removeClass('playing');
            playSound(soundWrong);
        	playerData.wrong_answers[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] += 1;
            resetStreak();
            nextTrack();
        }
        else if(isPlaying) {
            if(DIFFICULTYLEVEL >= 5 && audioPlayerHardcore.currentTime >= currentAudioTime + (currentSegmentDurations[0] * audioPlayerHardcore.playbackRate)) {
                var percent = playedTracks <= 1 ? 0 : Math.floor((playedTracks-1) / (TRACKSBYGAME/2) * 100);
                var rand = Math.floor(Math.random() * 100 + 1);
                if(rand <= percent) {
                    currentSegmentDurations = playedTracks-1 >= TRACKSBYGAME/2 ? shuffleArray(segmentDurations2) : shuffleArray(segmentDurations1);
                    currentAudioTime = Math.floor(Math.random() * 29);
                    audioPlayerHardcore.playbackRate = setPlaybackRate();
                    audioPlayerHardcore.currentTime = currentAudioTime;
                }
                else {
                    currentAudioTime = audioPlayerHardcore.currentTime;
                }
            }
        }
    });

    jsAudioPlayerHardcore.on('timeupdate', function(event) {
        if(isPlaying && audioPlayerHardcore.currentTime < 1)
            currentAudioTime = 0;
    });

    function audioCountdown() {
        var timer = DIFFICULTYLEVEL <= 2 ? DEFAULTTRACKDURATION - Math.floor(audioPlayer.currentTime) : TRACKSTART + HARDCOREMODETRACKDURATION - Math.floor(audioPlayer.currentTime);
        if(timer <= 0)
            return;
        $('.js-countdown').text(timer);
        if(isPlaying) {
            var currentDuration = DIFFICULTYLEVEL <= 2 ? DEFAULTTRACKDURATION : HARDCOREMODETRACKDURATION;
            var currentCoundtown = DIFFICULTYLEVEL <= 2 ? DEFAULTTRACKDURATION - audioPlayer.currentTime : TRACKSTART + HARDCOREMODETRACKDURATION - audioPlayer.currentTime;
            var countdownPercentage = currentCoundtown / currentDuration * 100;
            $('.js-countdown-bar').css('width', countdownPercentage + '%');
            window.requestAnimationFrame(audioCountdown);
        }
    };

    $('.js-login-button').on('click', function() {
        login();
    });

    $('.js-username, .js-userkey').on('keyup', function(e) {
        if(e.which == 13) {
            login();
        }
    });

    $('.js-logout-button').on('click', function() {
        logout();
    });

    $('.js-display-leaderboard').on('click', function() {

        if($(this).hasClass('active')) {
            closeLeaderboard();
            return;
        }

        if($('.js-wrapper').hasClass('game_ended'))
        	quitGame();

        // Build stats
        updateStatsGamesPlayed();
        updateStatsAnswers();
        updateStatsBestScore();

        // Build leaderboard
        getAllScores().then(function(result) {
        	var allScores = result;
            var leaderboard = {}
            var leaderboardCustom = {}
            for(var difficulty in DIFFICULTYNAMES) {
                leaderboard[DIFFICULTYNAMES[difficulty]]= {};
                leaderboardCustom[DIFFICULTYNAMES[difficulty]]= {};
            }            
            [leaderboard, leaderboardCustom] = returnBestScores(allScores, leaderboard, leaderboardCustom);
            // Display leaderboard
            buildLeaderboard(leaderboard, "Classement parties classiques");
            buildLeaderboard(leaderboardCustom, "Classement parties personnalisées");
            openLeaderboard();
        });

        // Build favorites
        for(var index in playerData.likedTracks) {
        	var trackIndex = playerData.likedTracks[index];
        	// Tracks infos
        	var trackArtistsText = "";
        	var trackArtists = tracks[trackIndex].track.artists;
        	for(var trackArtist in trackArtists) {
                trackArtistsText += trackArtists[trackArtist].name + ", ";
            }
            trackArtistsText = trackArtistsText.slice(0, -2);
        	var trackName = tracks[trackIndex].track.name;
        	var trackImage = tracks[trackIndex].track.album.images[1].url;
        		// Build HTML
        	var favoriteElem = $('<div class="track_display track_display--favorite"></div>');
        	favoriteElem.append('<div class="track_display__half track_display__half--cover track_display__half--cover_favorite"><img class="track_display__cover track_display__cover--favorite" src="' + trackImage + '"/></div>');
        	var favoriteElemDetails = $('<div class="track_display__details track_display__half track_display__half--details track_display__half--details_favorites"></div>');
        	var favoriteElemContent = $('<div class="track_display__content"></div>');
        	favoriteElemContent.append('<div class="track_display__name">' + trackName + '</div>');
        	favoriteElemContent.append('<div class="track_display__artist">' + trackArtistsText + '</div>');
        	favoriteElemDetails.append(favoriteElemContent);
        	var favoriteElemLike = $('<button class="track_display__like default_tooltip__wrapper js-like-track" data-liked="true" data-index="' + trackIndex + '"</button>');
        	favoriteElemLike.append($('<span class="track_display__like_legend default_tooltip default_transition" data-liked="true">Retirer des favoris</span>'));
        	favoriteElemLike.append($('<span class="track_display__like_legend default_tooltip default_transition" data-liked="false">Ajouter aux favoris</span>'));
        	favoriteElemDetails.append(favoriteElemLike);
        	favoriteElem.append(favoriteElemDetails);
        	$('.js-favorites-content').append(favoriteElem);
        }

        // Build liked tracks
        getLikedTracks().then(function(result) {
        	if(!('tracks' in playerData)) {
        		$('.js-liked-tracks-wrapper').addClass('visually_hidden');
        		return;        		
        	}
        	var resultObject = {};
        	var likedTracks = result;
        	var hasLikes = false;

        	for(var index in likedTracks) {
        		var row = likedTracks[index];
        		if(row.likedTracks == null)
        			continue;
        		for(var trackIndex in row.likedTracks) {
        			if(playerData.tracks.includes(row.likedTracks[trackIndex])) {
        				if (row.likedTracks[trackIndex] in resultObject)
        					resultObject[row.likedTracks[trackIndex]].push(row.initials);
        				else
        					resultObject[row.likedTracks[trackIndex]] = [row.initials];
        				var hasLikes = true;
        			}
        		}
        	}

        	if(!hasLikes) {
        		$('.js-liked-tracks-wrapper').addClass('visually_hidden');
        		return;
        	}

        	for(var index in resultObject) {
        		// Tracks infos
	        	var trackArtistsText = "";
	        	var trackArtists = tracks[index].track.artists;
	        	for(var trackArtist in trackArtists) {
	                trackArtistsText += trackArtists[trackArtist].name + ", ";
	            }     		
            	trackArtistsText = trackArtistsText.slice(0, -2);
        		var trackName = tracks[index].track.name;
        		var trackImage = tracks[index].track.album.images[1].url;   
        		// Build HTML
        		var likedElem = $('<div class="liked_track"></div>');
        		likedElem.append('<div class="liked_track__image"><img class="liked_track__cover" src="' + trackImage + '"/></div>');
	        	var likedElemDetails = $('<div class="liked_track__details"></div>');
	        	var likedElemContent = $('<div class="liked_track__content"></div>');
	        	likedElemContent.append('<div class="liked_track__name">' + trackName + '</div>');
	        	likedElemContent.append('<div class="liked_track__artist">' + trackArtistsText + '</div>');
	        	var likedElemAvatars = $('<div class="liked_track__avatars"></div>');
	        	for(userIndex in resultObject[index]) {
	        		likedElemAvatars.append('<div class="liked_track__user"><img src="assets/avatars/' + resultObject[index][userIndex] + '.png"/></div>');
	        	}
	        	likedElemContent.append(likedElemAvatars);
	        	likedElemDetails.append(likedElemContent);
	        	likedElem.append(likedElemDetails);
        		$('.js-liked-tracks').append(likedElem);
        		$('.js-liked-tracks-wrapper').removeClass('visually_hidden');
        	}
        });

        // Build assigned tracks
        getAssignedTracks(playerData.initials).then(function(result) {
        	if(result.length == 0) {
                $('.js-assigned-tracks-wrapper').addClass('visually_hidden');
                return;
            }
            var assignedTracks = result[0].assigned_tracks;
            var assignedTracksSorted = [];
            var assignedTracksPodium = {};
            var hasTracks = false;
            for(var trackIndex in assignedTracks) {
                assignedTracksSorted.push([trackIndex, assignedTracks[trackIndex]]);                
                var hasTracks = true;
            }
            if(!hasTracks) {
                $('.js-assigned-tracks-wrapper').addClass('visually_hidden');
                return;
            }
            assignedTracksSorted.sort((a,b) => (a[1] < b[1]) ? 1 : ((b[1] < a[1]) ? -1 : 0));
            for(var i=1;i<=3;i++) {
                var assignedTrack = assignedTracksSorted.shift();
                assignedTracksPodium[i] = [assignedTrack];
                if(assignedTracksSorted.length == 0)
                	break;
                while(assignedTracksSorted[0][1] == assignedTrack[1]) {
                    assignedTracksPodium[i].push(assignedTracksSorted.shift());
                    if(assignedTracksSorted.length == 0)
                    	break;
                }
                if(assignedTracksSorted.length == 0)
                   	break;
            }
            for(var position in assignedTracksPodium) {
                var assignedTrackRow = $('<div class="assigned_tracks_row"></div>');
                assignedTrackRow.append($('<div class="assigned_tracks_position">' + position + '</div>'));
                var assignedTrackContent = $('<div class="assigned_tracks_content"></div>');
                for(var index in assignedTracksPodium[position]) {
                    var trackIndex = parseInt(assignedTracksPodium[position][index][0]);
                    var trackAmount = parseInt(assignedTracksPodium[position][index][1]);
                    // Tracks infos
                    var trackArtistsText = "";
                    var trackArtists = tracks[trackIndex].track.artists;
                    for(var trackArtist in trackArtists) {
                        trackArtistsText += trackArtists[trackArtist].name + ", ";
                    }           
                    trackArtistsText = trackArtistsText.slice(0, -2);
                    var trackName = tracks[trackIndex].track.name;
                    var trackImage = tracks[trackIndex].track.album.images[1].url;
                    // Build HTML
                    var assignedElem = $('<div class="liked_track"></div>');
                    assignedElem.append('<div class="liked_track__image"><img class="liked_track__cover" src="' + trackImage + '"/></div>');
                    var assignedElemDetails = $('<div class="liked_track__details"></div>');
                    var assignedElemContent = $('<div class="liked_track__content"></div>');
                    assignedElemContent.append('<div class="liked_track__name">' + trackName + '</div>');
                    assignedElemContent.append('<div class="liked_track__artist">' + trackArtistsText + '</div>');
                    assignedElemContent.append($('<div class="liked_track__amount">' + trackAmount + ' fois</trackAmountdiv>'));
                    assignedElemDetails.append(assignedElemContent);
                    assignedElem.append(assignedElemDetails);
                    assignedTrackContent.append(assignedElem);
                }
                assignedTrackRow.append(assignedTrackContent);
                $('.js-assigned-tracks').append(assignedTrackRow);
                $('.js-assigned-tracks-wrapper').removeClass('visually_hidden');
            }
        });

        // Build trophies
        getAllProfiles().then(function(result) {
        	var gamesPlayed = [];
        	var answersRatio = [];
	        var totalScoresArray = [];
	        var mostLikedTracks = [];
            var lessLikedTracks = [];
            var allFavorites = {};
            var allFavoritesArray = [];
	        var mostFavorited = [];
            var totalFavorited = {};
            var totalFavoritedArray = [];
            var ownFavorited = {};
            var ownFavoritedArray = [];
            var mostAssignedtrack = [];
        	// Build data
        	for(var i in result) {
        		var player = result[i];
        		var totalGames = 0;
        		// Most / less games played
        		for(var j in player.games_played)
        			totalGames += player.games_played[j]
        		gamesPlayed[i] = [player.initials, totalGames];
        		// Best good answers ratio
        		if(totalGames > 0) {
		        	var goodAnswers = 0;
		        	var wrongAnswers = 0;
		        	var answersPercent = 0;
	        		for(var j in player.good_answers)
	        			goodAnswers += player.good_answers[j]
	        		for(var j in player.wrong_answers)
	        			wrongAnswers += player.wrong_answers[j]
	        		answersPercent = Math.ceil(goodAnswers / (goodAnswers + wrongAnswers) * 100) || 0;
	        		answersRatio.push([player.initials, answersPercent]);
	        	}
        		if(player.likedTracks != null) {
                    // Favorites
        			if(mostLikedTracks.length == 0 || mostLikedTracks[1] < player.likedTracks.length)
        				mostLikedTracks = [player.initials, player.likedTracks.length];
        			if(lessLikedTracks.length == 0 || lessLikedTracks[1] > player.likedTracks.length)
        				lessLikedTracks = [player.initials, player.likedTracks.length];
                    // Own favorited 1/2                      
                    if(!(player.initials in ownFavorited))
                        ownFavorited[player.initials] = 0
                    for(var i in player.likedTracks) {
                        // Most favorited
                        if(!(player.likedTracks[i] in allFavorites))
                            allFavorites[player.likedTracks[i]] = 1;
                        else
                            allFavorites[player.likedTracks[i]] += 1;;
                        // Own favorited 2/2
                        for(var j in playersData) {
                            if(playersData[j][2] == player.initials && playersData[j][1].indexOf(player.likedTracks[i]) >= 0)
                                ownFavorited[player.initials] += 1;
                        }
                    }
        		}
        	}
        	// Display data
        	// Most / less games played
        	gamesPlayed.sort((a,b) => (a[1] < b[1]) ? 1 : ((b[1] < a[1]) ? -1 : 0));
        	$('.js-trophy-most-games').attr('src', 'assets/avatars/' + gamesPlayed[0][0] + '.png');
        	$('.js-trophy-most-games-value').text(gamesPlayed[0][1]);
        	$('.js-trophy-less-games').attr('src', 'assets/avatars/' + gamesPlayed[gamesPlayed.length-1][0] + '.png');
        	$('.js-trophy-less-games-value').text(gamesPlayed[gamesPlayed.length-1][1]);
        	// Best / worst good answers ratio
        	answersRatio.sort((a,b) => (a[1] < b[1]) ? 1 : ((b[1] < a[1]) ? -1 : 0));
        	$('.js-trophy-precision').attr('src', 'assets/avatars/' + answersRatio[0][0] + '.png');
        	$('.js-trophy-precision-value').text(answersRatio[0][1]);
        	$('.js-trophy-less-precision').attr('src', 'assets/avatars/' + answersRatio[answersRatio.length-1][0] + '.png');
        	$('.js-trophy-less-precision-value').text(answersRatio[answersRatio.length-1][1]);
        	// Favorites
        	$('.js-trophy-most-favorites').attr('src', 'assets/avatars/' + mostLikedTracks[0] + '.png');
        	$('.js-trophy-most-favorites-value').text(mostLikedTracks[1]);
        	$('.js-trophy-less-favorites').attr('src', 'assets/avatars/' + lessLikedTracks[0] + '.png');
        	$('.js-trophy-less-favorites-value').text(lessLikedTracks[1]);
            // Most favorited
            for(var i in allFavorites)
                allFavoritesArray.push([i, allFavorites[i]]);
            allFavoritesArray.sort((a,b) => (a[1] < b[1]) ? 1 : ((b[1] < a[1]) ? -1 : 0));
            var mostFavoritedInitials = "";
            var mostFavoritedIndex = -1;
            for(var i in playersData) {
                if(playersData[i][1].indexOf(parseInt(allFavoritesArray[0][0])) >= 0) {
                    mostFavoritedInitials = playersData[i][2];
                    mostFavoritedIndex = parseInt(allFavoritesArray[0][0]);
                }
            }
            $('.js-trophy-most-favorited').attr('src', 'assets/avatars/' + mostFavoritedInitials + '.png');
            $('.js-trophy-most-favorited-value').text(allFavoritesArray[0][1]);
            // Most and less favorited total
            for(var i in playersData) {
                for(var j in playersData[i][1]) {
                    if(!(playersData[i][2] in totalFavorited))
                        totalFavorited[playersData[i][2]] = 0;
                    if(playersData[i][1][j] in allFavorites) {
                        totalFavorited[playersData[i][2]] += allFavorites[playersData[i][1][j]];
                        
                    }
                }
            }
            for(var i in totalFavorited)
                totalFavoritedArray.push([i, totalFavorited[i]]);
            totalFavoritedArray.sort((a,b) => (a[1] < b[1]) ? 1 : ((b[1] < a[1]) ? -1 : 0));
            $('.js-trophy-total-favorited').attr('src', 'assets/avatars/' + totalFavoritedArray[0][0] + '.png');
            $('.js-trophy-total-favorited-value').text(totalFavoritedArray[0][1]);
            $('.js-trophy-less-total-favorited').attr('src', 'assets/avatars/' + totalFavoritedArray[totalFavoritedArray.length-1][0] + '.png');
            $('.js-trophy-less-total-favorited-value').text(totalFavoritedArray[totalFavoritedArray.length-1][1]);
            // Own favorites
            for(var i in ownFavorited)
                ownFavoritedArray.push([i, ownFavorited[i]]);
            ownFavoritedArray.sort((a,b) => (a[1] < b[1]) ? 1 : ((b[1] < a[1]) ? -1 : 0));
            $('.js-trophy-own-favorited').attr('src', 'assets/avatars/' + ownFavoritedArray[0][0] + '.png');
            $('.js-trophy-own-favorited-value').text(ownFavoritedArray[0][1]);

        	// Best and worst scores        	
        	getAllScores().then(function(result) {
	        	var allScores = result;
	            var leaderboard = {}
	            var leaderboardCustom = {}
	            var totalScores = {};
	            for(var difficulty in DIFFICULTYNAMES) {
	                leaderboard[DIFFICULTYNAMES[difficulty]]= {};
	                leaderboardCustom[DIFFICULTYNAMES[difficulty]]= {};
	            }            
	            [leaderboard, leaderboardCustom] = returnBestScores(allScores, leaderboard, leaderboardCustom);
	            for(var i in leaderboard) {
	            	for(var j in leaderboard[i]) {
	            		var initials = leaderboard[i][j][3];
	            		if(!(initials in totalScores)) 
	            			totalScores[leaderboard[i][j][3]] = leaderboard[i][j][2];
	            		else
		            		totalScores[leaderboard[i][j][3]] += leaderboard[i][j][2];
	            	}
	            }
	            var counter = 0;
	            for(var i in totalScores) {
	            	totalScoresArray[counter] = [i, totalScores[i]];
	            	counter += 1;
	            }
	        	// Display data 
	        	totalScoresArray.sort((a,b) => (a[1] < b[1]) ? 1 : ((b[1] < a[1]) ? -1 : 0));
	        	$('.js-trophy-best-scores').attr('src', 'assets/avatars/' + totalScoresArray[0][0] + '.png');
	        	$('.js-trophy-best-scores-value').text(totalScoresArray[0][1]);  
	        	$('.js-trophy-worst-scores').attr('src', 'assets/avatars/' + totalScoresArray[totalScoresArray.length-1][0] + '.png');
	        	$('.js-trophy-worst-scores-value').text(totalScoresArray[totalScoresArray.length-1][1]);  
	        });

	        // Assigned tracks
	        getGameAllData().then(function(result) {
	        	var allData = result;
	        	var resObject = {};
	        	var resArray = [];
	        	// Loop players
	        	for(var i in allData) {
	        		var player = allData[i];
	        		resObject[player[2]] = {};
	        		// Loop assigned tracks
	        		for(var j in player[3]) {
	        			var [assignedTrack, amount] = [j, player[3][j]];
	        			// Loop other players to find assigned track owner
	        			for(var k in allData) {
	        				var otherPlayer = allData[k];
	        				if(otherPlayer[1].indexOf(parseInt(assignedTrack)) >= 0) {
	        					if(!(otherPlayer[0] in resObject[player[2]]))
	        						resObject[player[2]][otherPlayer[0]] = amount;
	        					else 
	        						resObject[player[2]][otherPlayer[0]] += amount;
	        					break;
	        				}
	        			}
	        		}
	        		// Search for max
	        		for(var j in resObject[player[2]]) {
	        			var current = resObject[player[2]][j];
	        			if(resArray.length == 0 || resArray[2] < current) {
	        				resArray = [player[2], j, current];
	        			}
	        		}
	        	}
	        	mostAssignedtrack = resArray;
	        	$('.js-trophy-assigned').attr('src', 'assets/avatars/' + mostAssignedtrack[0] + '.png');
	        	$('.js-trophy-assigned-name').text(mostAssignedtrack[1]);
	        	$('.js-trophy-assigned-value').text(mostAssignedtrack[2]);
	        });
        });

    });

    $('.js-close-leaderboard').on('click', function() {
        closeLeaderboard();
    });

    // Tabs
    $('.js-tab').on('click', function() {
        if($(this).hasClass('active'))
            return;
        var target = $(this).attr('rel');
        $('.js-tab.active').removeClass('active');
        $('.js-tab-section.active').removeClass('active');
        $(this).addClass('active');
        $('.js-tab-section[rel="' + target + '"]').addClass('active');
    });

    function buildLeaderboard(object, title) {        
        var counter = 0;
        $('.js-leaderboard-content').append('<span class="leaderboard__section_title">' + title + '</span>');
        for(var difficulty in DIFFICULTYNAMES) {
            counter += 1;
            var label = DIFFICULTYNAMES[difficulty];
            if(object[label].length == 0)
                continue;
            $('.js-leaderboard-content').append('<span class="leaderboard__title leaderboard__title--' + counter + ' panel_label">' + label + '</span>');
            var scoresList = $('<ul class="leaderboard__list"></ul>');
            scoresList.append($('<li class="leaderboard__item"><span class="leaderboard__value--head leaderboard__value--name">Joueur</span><span class="leaderboard__value--head leaderboard__value--tracks">Nombre de morceaux</span><span class="leaderboard__value--head leaderboard__value--points">Score</span></li>'));
            var i = 0;
            for(var currentScore in object[label]) {
                var [name, tracks, points] = object[label][currentScore];
                var scoresItem = $('<li class="leaderboard__item"></li>')
                scoresItem.append($('<span class="leaderboard__value leaderboard__value--name">' + name + '</span>'));
                scoresItem.append($('<span class="leaderboard__value leaderboard__value--tracks">' + tracks + '</span>'));
                scoresItem.append($('<span class="leaderboard__value leaderboard__value--points">' + points + '</span>'));
                scoresList.append(scoresItem);
            }
            $('.js-leaderboard-content').append(scoresList);
        }
    }

    function resetCountdownBar(value = '100%', transition = 0) {
        $('.js-countdown-bar').css('width', value);
        $('.js-countdown-bar').attr('data-timer', DIFFICULTYLEVEL <= 2 ? DEFAULTTRACKDURATION : HARDCOREMODETRACKDURATION);
        $('.js-countdown').text(0);
    }

    function setPlaybackRate() {
        var rate = 1;
        var percent = playedTracks <= 1 ? 0 : Math.floor((playedTracks-1) / TRACKSBYGAME * 100);
        var rand = Math.floor(Math.random() * 100 + 1);
        if(rand <= percent) {
            modifierRates = shuffleArray(modifierRates);
            rate = modifierRates[0];
        }
        return rate;
    }

    function login() {
        USERNAME = $('.js-username').val().toLowerCase();
        USERKEY = $('.js-userkey').val().toLowerCase();
        getPlayerData().then(function(result) {
            if(result.id != null) {
                playerData = result;
                // Get current player tracks
                for(var playerIndex in playersData) {
                    var currentPlayer = playersData[playerIndex];
                    if(currentPlayer[2] == playerData.initials) {
                        playerData.tracks = currentPlayer[1];
                        break;
                    }
                }
                getScores().then(function(result) {
                    playerData.scores = result[0].scores || [];
                });
                window.localStorage.setItem("username", USERNAME);
                window.localStorage.setItem("userkey", USERKEY);
                $('.js-username').val('');
                $('.js-userkey').val('');
                $('.js-settings').addClass('visible');
                $('.js-bar-top').addClass('visible');
                $('.js-login').removeClass('visible');
            }
            else {
                alert('Les identifiants sont incorrects');
            }
        });
    }

    function logout() {
        USERNAME = '';
        USERKEY = ''; 
        window.localStorage.removeItem("username");
        window.localStorage.removeItem("userkey");
        closeLeaderboard();
        $('.js-settings').removeClass('visible');
        $('.js-bar-top').removeClass('visible');
        $('.js-login').addClass('visible');
        $('.js-wrapper').removeClass('game_ended');
    }

    function playSound(soundElem) {
        soundElem.currentTime = 0;
        soundElem.play();
    }

    function nextTrack() {
        setTimeout(function() {
            if(setList.length > 0) {
                resetCountdownBar();
                setTimeout(function() {
                    playTrack();
                }, 20);
            }
            else if($('.js-wrapper').hasClass('game_started'))
                endGame();
        }, 1000);
    }

    function setLikeButton(index) {
        $('.js-like-track').attr('data-liked', playerData.likedTracks.indexOf(index) >= 0);
    }

    function endGame() {
        // Update scores
        playerData.scores.push([DIFFICULTYNAMES[DIFFICULTYLEVEL-1], TRACKSBYGAME, score]);
        updateScores(playerData.scores);
        // Update games played
        if(!DIFFICULTYNAMES[DIFFICULTYLEVEL-1] in playerData.games_played || playerData.games_played[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] == null)
            playerData.games_played[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] = 0;
        playerData.games_played[DIFFICULTYNAMES[DIFFICULTYLEVEL-1]] += 1;
        updateStatsGamesPlayed();
        updateGamesPlayed(playerData.games_played);
        // Update good/bad answers        
        updateStatsAnswers();
        updateAnswers(playerData.good_answers, playerData.wrong_answers);
        // Update bad answers
        // End game
        $('.js-wrapper').removeClass('game_started');
        $('.js-wrapper').addClass('game_ended');
        $('.js-score-wrapper').removeClass('visible');
        if(DIFFICULTYLEVEL == 5) {
            document.body.style.setProperty('--glitchedOpacity', 0);
            $('body').removeClass('glitched_halfgame');
        }
    }

    function returnBestScores(allScores, leaderboard, leaderboardCustom) {
    	for(var element in allScores) {
            var scores = allScores[element].scores;
            if(scores == null)
                continue;
            var name = allScores[element].name;
            var initials = allScores[element].initials;
            for(var currentScore in scores) {
                var [difficulty, tracks, points] = scores[currentScore];
                // Build custom leaderboard
                if(tracks != DEFAULTTRACKSBYGAME) {
                    if(!(name in leaderboardCustom[difficulty]))
                        leaderboardCustom[difficulty][name] = [name, tracks, points, initials];
                    else if(leaderboardCustom[difficulty][name][2] < points)
                        leaderboardCustom[difficulty][name] = [name, tracks, points, initials];                        
                }
                // Build default leaderboard
                else {
                    if(!(name in leaderboard[difficulty]))
                        leaderboard[difficulty][name] = [name, tracks, points, initials];
                    else if(leaderboard[difficulty][name][2] < points)
                        leaderboard[difficulty][name] = [name, tracks, points, initials];
                }
            }
        }
        // Keep only best score for each player
        for(var difficulty in DIFFICULTYNAMES) {
            // Leaderboard custom
            var difficultyTableCustom = [];
            for(var playerName in leaderboardCustom[DIFFICULTYNAMES[difficulty]])
                difficultyTableCustom.push(leaderboardCustom[DIFFICULTYNAMES[difficulty]][playerName]);
            difficultyTableCustom.sort((a,b) => (a[2] < b[2]) ? 1 : ((b[2] < a[2]) ? -1 : 0));
            leaderboardCustom[DIFFICULTYNAMES[difficulty]] = difficultyTableCustom;                
            // Leaderboard default
            var difficultyTable = [];
        	for(var playerName in leaderboard[DIFFICULTYNAMES[difficulty]])
        		difficultyTable.push(leaderboard[DIFFICULTYNAMES[difficulty]][playerName]);
        	difficultyTable.sort((a,b) => (a[2] < b[2]) ? 1 : ((b[2] < a[2]) ? -1 : 0));
        	leaderboard[DIFFICULTYNAMES[difficulty]] = difficultyTable;
        }

        return [leaderboard, leaderboardCustom];
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    function updateTrackNumber() {
        $('.js-track-number').text(playedTracks);
    }

    function updateScore(increment = 0) {
        $('.js-score').text(score);
        if(increment > 0) {
            $('.js-multiplicator').parent().append($('<span class="score_increment score_increment--base">+' + increment + '</span>'));
            if(streakBonus > 0)
                $('.js-streak-wrapper').append($('<span class="score_increment score_increment--streak">+' + (streakBonus * POINTSMULTIPLICATOR) + '</span>'));
            setTimeout(function() {
                $('.score_increment').addClass('animate');
            }, 10);
            setTimeout(function() {
                $('.score_increment').addClass('fade');
            }, 910);
            setTimeout(function() {
                $('.score_increment').remove();
            }, 1010);
        }
    }

    function updateStatsGamesPlayed() {
    	$('.js-games-played').each(function() {
    		var level = $(this).attr('rel');
    		$(this).text(playerData.games_played[level]);
    	});
    }

    function updateStatsAnswers() {
    	$('.js-good-answers').each(function() {
    		var level = $(this).attr('rel');
    		$(this).text(playerData.good_answers[level]);
    	});
    	$('.js-wrong-answers').each(function() {
    		var level = $(this).attr('rel');
    		$(this).text(playerData.wrong_answers[level]);
    	});
    }

    function updateStatsBestScore() {

        var bestScores = {
            "Normal": 0,
            "Difficile": 0,
            "Infernal": 0,
            "Extrême": 0
        }

        for(scoreItem in playerData.scores) {
            var currentData = playerData.scores[scoreItem];
            var currentDifficulty = currentData[0];
            var currentScore = currentData[2];
            bestScores[currentDifficulty] = bestScores[currentDifficulty] > currentScore ? bestScores[currentDifficulty] : currentScore;
        }

        $('.js-best-score').each(function() {
            var level = $(this).attr('rel');
            $(this).text(bestScores[level]);
        });
    }

    function resetStreak() {
        streak = 0;
        streakBonus = 0;
        $('.js-streak-wrapper').removeClass('active');
        $('.js-streak').text('');
    }

    function resetGame() {        
        quitGame();
        buildSetlist();
    }

    function quitGame() {        
        score = 0;
        updateScore();
        resetStreak();
        setList = [];
        setListLength = 0;
        tracksIndexes = [];
        playedTracks = 0;
        playersDataBuild = JSON.parse(JSON.stringify(playersData));
        $('.js-wrapper').removeClass('game_ended');
        $('.js-score-wrapper').removeClass('visible');        
        if(DIFFICULTYLEVEL == 5) {
            document.body.style.setProperty('--glitchedOpacity', 0);
            $('body').removeClass('glitched_halfgame');
        }
    }

    function openLeaderboard() {
        $('body.glitched').addClass('no_glitch');
        $('.js-settings').removeClass('visible');
        $('.js-leaderboard').addClass('visible');
        $('.js-close-leaderboard').addClass('visible');
        $('.js-logout-button').addClass('hidden');
        $('.js-display-leaderboard').addClass('active');
        $('#wrapper').removeClass('game_ended');
    }

    function closeLeaderboard() {
        $('body.glitched').removeClass('no_glitch');
        $('.js-settings').addClass('visible');
        $('.js-leaderboard').removeClass('visible');
        $('.js-close-leaderboard').removeClass('visible');
        $('.js-display-leaderboard').removeClass('active');
        $('.js-logout-button').removeClass('hidden');
        $('.js-leaderboard-content').empty();
        $('.js-favorites-content').empty();
        $('.js-liked-tracks').empty();
        $('.js-assigned-tracks').empty();
    }

    return {
        init() {
            updateScore();
            loadPlaylist();
        }
    }

})(UIController, APIController);

APPController.init();

// Database getters
async function getGameData() {
    const { data, error } = await _supabase
        .from('names')
        .select('name, tracks, initials');
    var res = [];
    for(elem in data)
        res.push([data[elem].name, data[elem].tracks, data[elem].initials]);
    return res;
}

async function getGameAllData() {
    const { data, error } = await _supabase
        .from('names')
        .select('*');
    var res = [];
    for(elem in data)
        res.push([data[elem].name, data[elem].tracks, data[elem].initials, data[elem].assigned_tracks]);
    return res;
}

async function getPlayerData() {
    var { data, error } = await _supabase.rpc('get_profile', {current_user_name: USERNAME, current_user_key: USERKEY});
    if(data.likedTracks == null)
        data.likedTracks = [];
    return data;
}

async function updateLikedTracks(likedTracks) {
    const { error } = await _supabase
        .from("profiles")
        .update({ 'likedTracks': likedTracks })
        .eq('username', USERNAME)
        .eq('userkey', USERKEY);
    if(error != null)
        console.log(error);
}

async function getScores() {
    const { data, error } = await _supabase
        .from("scores")
        .select('scores')
        .eq('name', USERNAME);
    if(error != null)
        console.log(error);
    if(data == null)
        data = [];
    return data;
}

async function getLikedTracks() {
    const { data, error } = await _supabase
        .from("profiles")
        .select('initials, likedTracks');
    if(error != null)
        console.log(error);
    if(data == null)
        data = [];
    return data;
}

async function getAllScores() {
    const { data, error } = await _supabase
        .from("scores")
        .select('*');
    if(error != null)
        console.log(error);
    if(data == null)
        data = [];
    return data;
}

async function getAssignedTracks(initials) {
    const { data, error } = await _supabase
        .from("names")
        .select('assigned_tracks')
        .eq('initials', initials);
    if(error != null)
        console.log(error);
    if(data == null)
        data = {};
    return data;
}

async function getAllProfiles() {
    const { data, error } = await _supabase
        .from("profiles")
        .select('*');
    if(error != null)
        console.log(error);
    if(data == null)
        data = {};
    return data;
}

async function updateScores(scores) {
    const { error } = await _supabase
        .from("scores")
        .update({ 'scores': scores })
        .eq('name', USERNAME);
    if(error != null)
        console.log(error);
}

async function updateGamesPlayed(amount) {
    const { error } = await _supabase
        .from("profiles")
        .update({ 'games_played': amount })
        .eq('userkey', USERKEY);
    if(error != null)
        console.log(error);
}

async function updateAnswers(good, wrong) {
    const { error } = await _supabase
        .from("profiles")
        .update({ 'good_answers': good, 'wrong_answers': wrong })
        .eq('userkey', USERKEY);
    if(error != null)
        console.log(error);
}

async function updateAssignedTracks(name, trackIndex) {
    const { data, error } = await _supabase
        .from("names")
        .select('assigned_tracks')
        .eq('name', name);
    if(error != null)
        console.log(error);
    var assignedTracks = data[0].assigned_tracks;
    if(assignedTracks == null)
        assignedTracks = {};
    var amount = 1;
    if(Object.hasOwn(assignedTracks, trackIndex))
        amount = +assignedTracks[trackIndex] + 1;
    assignedTracks[trackIndex] = amount;
    const { error2 } = await _supabase
        .from("names")
        .update({ 'assigned_tracks': assignedTracks })
        .eq('name', name);
    if(error != null)
        console.log(error2);
}