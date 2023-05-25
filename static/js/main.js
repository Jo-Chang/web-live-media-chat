console.log('In main.js!')

var mapPeers = {}

var usernameInput = document.getElementById('username')
var btnJoin = document.getElementById('btn-join')

var username

var webSocket

function webSocketOnMessage(event) {
  var parsedData = JSON.parse(event.data)
  // var message = parsedData['message']
  // console.log('message: ', message)

  var peerUsername = parsedData['peer']
  var action = parsedData['action']

  if(username == peerUsername) {
    return
  }

  var receiver_channel_name = parsedData['message']['receiver_channel_name']

  if(action === 'new-peer'){
    createOfferer(peerUsername, receiver_channel_name)

    return
  }

  if(action == 'new-offer'){
    var offer = parsedData['message']['sdp']

    createAnswerer(offer, peerUsername, receiver_channel_name)

    return
  }

  if(action == 'new-answer'){
    var answer = parsedData['message']['sdp']

    var peer = mapPeers[peerUsername][0]

    peer.setRemoteDescription(answer)

    return
  }
}

btnJoin.addEventListener('click', () => {
  username = usernameInput.value

  console.log('username: ', username)

  if(username == '') {
    // 방으로 들어갈 수 없음
    return
  }

  usernameInput.value = ''
  usernameInput.disabled = true
  usernameInput.style.visibility = 'hidden'

  btnJoin.disabled = true
  btnJoin.style.visibility = 'hidden'

  var labelUsername = document.getElementById('label-username')
  labelUsername.innerHTML = username

  var loc = window.location
  var wsStart = 'ws://'

  if(loc.protocol == 'https:'){
    wsStart = 'wss://'
  }

  var endPoint = wsStart + loc.host + loc.pathname
  
  console.log('endPoint: ', endPoint)

  webSocket = new WebSocket(endPoint)

  webSocket.addEventListener('open', (event) => {
    console.log('Connection Opened!')

    sendSignal('new-peer', {})
  })
  webSocket.addEventListener('message', webSocketOnMessage)
  webSocket.addEventListener('close', (event) => {
    console.log('Connection Closed!')
  })
  webSocket.addEventListener('error', (event) => {
    console.log('Error Occurred!')
  })
})

var localStream = new MediaStream()

const constraints = {
  'video': true,
  'audio': true
}

const localVideo = document.getElementById('local-video')

// Toggle Audio, Video
const btnToggleAudio = document.getElementById('btn-toggle-audio')
const btnToggleVideo = document.getElementById('btn-toggle-video')

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
  .then(stream => {
    localStream = stream
    localVideo.srcObject = localStream
    localVideo.muted = true

    var audioTracks = stream.getAudioTracks()
    var videoTracks = stream.getVideoTracks()

    videoTracks[0].enabled = true
    
    btnToggleAudio.addEventListener('click', () => {
      audioTracks[0].enabled = !audioTracks[0].enabled      

      if(audioTracks[0].enabled){
        btnToggleAudio.textContent = 'Audio Mute'

        return
      }

      btnToggleAudio.textContent = 'Audio Unmute'
    })
    btnToggleVideo.addEventListener('click', () => {
      videoTracks[0].enabled = !videoTracks[0].enabled      
      
      if(videoTracks[0].enabled){
        btnToggleVideo.textContent = 'Video Off'
        
        return
      }

      btnToggleVideo.textContent = 'Video On'
    })
  })
  .catch(error => {
    console.log('Error accessing media devices.')
  })

// Chat Message
var btnSendMsg = document.getElementById('btn-send-msg')
var messageList = document.getElementById('message-list')
var messageInput = document.getElementById('msg')

btnSendMsg.addEventListener('click', sendMsgOnClick)

function sendMsgOnClick(){
  var message = messageInput.value

  var newLi = document.createElement('li')
  newLi.appendChild(document.createTextNode('Me: ' + message))
  messageList.appendChild(newLi)

  var dataChannels = getDataChannels()

  message = username + ': ' + message

  for(index in getDataChannels){
    dataChannels[index].send(message)
  }

  // Clear the message input
  messageInput.value = '' 
}
  
function sendSignal(action, message){
  // testing
  var jsonStr = JSON.stringify({
    'peer': username,
    'action': action,
    'message': message,
  })

  webSocket.send(jsonStr)
}

function createOfferer(peerUsername, receiver_channel_name){
  var peer = new RTCPeerConnection(null)

  addLocalTracks(peer)

  var dc = peer.createDataChannel('channel')
  dc.addEventListener('open', () => {
    console.log('Connetion opened!')
  })
  dc.addEventListener('message', dcOnMessage)

  var remoteVideo = createVideo(peerUsername)
  setOnTrack(peer, remoteVideo)

  mapPeers[peerUsername] = [peer, dc]

  peer.addEventListener('iceconnectionstatechange', () => {
    var iceConnectionState = peer.iceConnectionState

    if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
      delete mapPeers[peerUsername]

      if(iceConnectionState != 'closed'){
        peer.close()
      }

      removeVideo(remoteVideo)
    }
  })

  peer.addEventListener('icecandidate', (event) => {
    if(event.candidate){
      console.log('New ice candidate: ', JSON.stringify(peer.localDescription))

      return
    }

    sendSignal('new-offer', {
      'sdp': peer.localDescription,
      'receiver_channel_name': receiver_channel_name
    })
  })

  peer.createOffer()
    .then(o => peer.setLocalDescription(o))
    .then(() => {
      console.log('Local description set successfully.')
    })
}

function addLocalTracks(peer) {
  localStream.getTracks().forEach(track => {
    peer.addTrack(track, localStream)
  })
}

function createAnswerer(offer, peerUsername, receiver_channel_name){
  var peer = new RTCPeerConnection(null)

  addLocalTracks(peer)

  var remoteVideo = createVideo(peerUsername)
  setOnTrack(peer, remoteVideo)

  peer.addEventListener('datachannel', e => {
    peer.dc = e.channel
    peer.dc.addEventListener('open', () => {
      console.log('Connetion opened!')
    })
    peer.dc.addEventListener('message', dcOnMessage)

    mapPeers[peerUsername] = [peer, peer.dc]
  })

  peer.addEventListener('iceconnectionstatechange', () => {
    var iceConnectionState = peer.iceConnectionState

    if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
      delete mapPeers[peerUsername]

      if(iceConnectionState != 'closed'){
        peer.close()
      }

      removeVideo(remoteVideo)
    }
  })

  peer.addEventListener('icecandidate', (event) => {
    if(event.candidate){
      console.log('New ice candidate: ', JSON.stringify(peer.localDescription))

      return
    }

    sendSignal('new-answer', {
      'sdp': peer.localDescription,
      'receiver_channel_name': receiver_channel_name
    })
  })

  peer.setRemoteDescription(offer)
    .then(() => {
      console.log('Remote description set successfully for %s.', peerUsername)

      return peer.createAnswer()
    })
    .then(a => {
      console.log('Answer created!')

      peer.setLocalDescription(a)
    })
}

function dcOnMessage(event){
  var message = event.data

  var newLi = document.createElement('li')
  newLi.appendChild(document.createTextNode(message))
  messageList.appendChild(newLi)
}

function createVideo(peerUsername){
  var videoContainer = document.getElementById('video-container')

  var remoteVideo = document.createElement('video')

  remoteVideo.id = peerUsername + '-video'
  remoteVideo.autoplay = true
  remoteVideo.playsinline = true

  var videoWrapper = document.createElement('div')

  videoContainer.appendChild(videoWrapper)

  videoWrapper.appendChild(remoteVideo)

  return remoteVideo
}

function setOnTrack(peer, remoteVideo){
  var remoteStream = new MediaStream()

  remoteVideo.srcObject = remoteStream
  
  peer.addEventListener('track', async (event) => {
    remoteStream.addTrack(event.track, remoteStream)
  })
}

function removeVideo(video) {
  var videoWrapper = video.parentNode

  videoWrapper.parentNode.removeChild(videoWrapper)
}

function getDataChannels() {
  var dataChannels = []

  for(peerUsername in mapPeers){
    var dataChannel = mapPeers[peerUsername][1]

    dataChannels.push(dataChannel)
  }
}