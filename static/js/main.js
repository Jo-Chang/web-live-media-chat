console.log('In main.js!')

var mapPeers = {}

var usernameInput = document.getElementById('username')
var btnJoin = document.getElementById('btn-join')

var username

var webSocket

btnJoin.addEventListener('click', () => {
  console.log('===== btnJoin.addEventListener()! =====')

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

  // WebSocket 연결 경로
  var endPoint = wsStart + loc.host + loc.pathname
  
  console.log('endPoint: ', endPoint)

  // WebSocket 연결
  webSocket = new WebSocket(endPoint)
  console.log(webSocket)
  
  // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/open_event
  // webSocket 이벤트
  // webSocket이 열렸을때 발생하는 이벤트
  webSocket.addEventListener('open', (event) => {
    console.log('Connection Opened!')

    // 'new-peer' 액션 : 소켓이 열렸을때 메세지
    sendSignal('new-peer', {})
  })
  // webSocket이 메세지를 받았을때 발생하는 이벤트
  webSocket.addEventListener('message', webSocketOnMessage)
  webSocket.addEventListener('close', (event) => {
    console.log('Connection Closed!')
  })
  // webSocket이 메세지를 닫혔을때 발생하는 이벤트
  webSocket.addEventListener('error', (event) => {
    console.log('Error Occurred!')
  })
})

function webSocketOnMessage(event) {
  console.log('===== webSocketOnMessage()! =====')

  var parsedData = JSON.parse(event.data)
  // var message = parsedData['message']
  // console.log('message: ', message)

  var peerUsername = parsedData['peer']
  var action = parsedData['action']

  if(username === peerUsername) {
    console.log('username == peerUsername')
    return
  }

  var receiver_channel_name = parsedData['message']['receiver_channel_name']

  // 소켓이 open event 발생했을때, 연결되었을때 메세지
  /// 새로운 유저가 입장했을 때, 기존 유저들 액션
  if(action === 'new-peer'){
    console.log('new peer action!!!')

    // 제공자들 액션
    // 소켓에 action:'new-offer' 메세지 전송
    createOfferer(peerUsername, receiver_channel_name)

    return
  }

  /// 새로운 유저가 입장했을 때, 신규 유저 액션
  if(action == 'new-offer'){
    console.log('new offer action!!!')

    // RTCSessionDesciprtion sdp
    var offer = parsedData['message']['sdp']

    // 수신자(신규 유저) 액션
    // 소켓에 action:'new-answer' 메세지 전송
    createAnswerer(offer, peerUsername, receiver_channel_name)

    return
  }

  if(action == 'new-answer'){
    console.log('new answer action!!!')

    var answer = parsedData['message']['sdp']

    var peer = mapPeers[peerUsername][0]

    console.log('setRemoteDescription(answer) : ', answer)

    console.log('check my sdp :', peer.localDescription)
    peer.setRemoteDescription(answer)

    return
  }

  console.log('no action!!!')
}

// Media Content를 담아두는 MediaStream 객체
// CanvasCaptureMediaStream()도 존재
var localStream = new MediaStream()

const constraints = {
  'video': true,
  'audio': true
}

const localVideo = document.getElementById('local-video')

// Toggle Audio, Video
const btnToggleAudio = document.getElementById('btn-toggle-audio')
const btnToggleVideo = document.getElementById('btn-toggle-video')

// https://developer.mozilla.org/ko/docs/Web/API/MediaDevices/getUserMedia
// 사용자에게 미디어 입력 장치 사용 권한을 요청,
// 수락하면 요청한 미디어 종류의 트랙을 포함한 MediaStream을 반환
var userMedia = navigator.mediaDevices.getUserMedia(constraints)
  .then(stream => {
    // 스트림 사용
    localStream = stream
    localVideo.srcObject = localStream
    localVideo.muted = true

    // get 오디오, 비디오 트랙 
    var audioTracks = stream.getAudioTracks()
    var videoTracks = stream.getVideoTracks()

    // 룸 입장시 초기 설정 뮤트, 비디오 off
    videoTracks[0].enabled = false
    audioTracks[0].enabled = false
    
    // 오디오 mute/unmute toggle 버튼
    btnToggleAudio.addEventListener('click', () => {
      audioTracks[0].enabled = !audioTracks[0].enabled      
      
      if(audioTracks[0].enabled){
        btnToggleAudio.textContent = 'Audio Mute'
        
        return
      }
      
      btnToggleAudio.textContent = 'Audio Unmute'
    })
    // 비디오 on/off toggle 버튼
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
    // 오류 처리
    console.log('Error accessing media devices.')
  })
  
// WebSocket에 신호 전송
// action : 'new-peer', 'new-offer', 'new-answer'
function sendSignal(action, message){
  // testing
  var jsonStr = JSON.stringify({
    'peer': username,
    'action': action,
    'message': message,
  })

  webSocket.send(jsonStr)
}

// 유저가 입장해서 웹 소켓 연결됐을때, Offerer
function createOfferer(peerUsername, receiver_channel_name){
  // RTCPeerConnection 객체 생성 -> peer(instance)
  var peer = new RTCPeerConnection(null)

  // local에 있는 모든 MediaStreamTracks, peer에 추가
  addLocalTracks(peer)

  // 데이터 송신을 위해 원격 유저와 연결하는 신규 채널 생성
  // 이미지, 파일 전송, 문자 채팅, 게임 패킷 업데이트 등 ...
  // 'channel' : 사람이 읽을 수 있는 채널 이름
  // var dc = peer.createDataChannel('channel')
  // // peer 연결이 열렸을때,
  // dc.addEventListener('open', () => {
  //   console.log('Connetion opened!')
  // })
  // // {{채팅}} peer 연결에 message를 전송할 때, 
  // dc.addEventListener('message', dcOnMessage)

  // remoteVideo HTML 요소 생성
  var remoteVideo = createVideo(peerUsername)
  // remoteVideo stream track 연결
  setOnTrack(peer, remoteVideo)

  // mapPeer 딕셔너리에 peerUsername : [peer, dc] 추가
  mapPeers[peerUsername] = [peer, '']

  // ICE : Interactive Connectivity Establishment
  // 협상 프로세스 중 ICE 연결 상태 변화가 생겼을때 발생, 상태 변화가 실패했을 때, ICE restart
  // -> RTCPeerConnection 연결에 변화가 생겼을때
  peer.addEventListener('iceconnectionstatechange', () => {
    // ICE agent 상태 string 반환
    // -> new, checking, connected, completed, failed, disconnected, closed
    var iceConnectionState = peer.iceConnectionState

    if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
      delete mapPeers[peerUsername]

      if(iceConnectionState != 'closed'){
        peer.close()
      }

      // <video> 삭제
      removeVideo(remoteVideo)
    }
  })

  // RTCIceCandidate가 식별되거나 추가될때,
  peer.addEventListener('icecandidate', (event) => {
    // event.candidate가 존재하면 원격 유저에게 
    if(event.candidate){
      // console.log('New ice candidate: ', JSON.stringify(peer.localDescription))

      return
    }

    // 모든 ICE candidate가 원격 유저에게 전달되었을 때,
    // 유저가 'new-peer' 메세지를 전송한후 'new-offer' 메세지 전송
    // RTCPeerConnection이 연결되었을때, 
    sendSignal('new-offer', {
      // RTCSessionDescription
      'sdp': peer.localDescription,
      'receiver_channel_name': receiver_channel_name
    })
  })

  // 새 WebRTC 연결을 위해 SDP offer 생성
  peer.createOffer()
    .then(o => peer.setLocalDescription(o))
    .then(() => {
      console.log('Local description set successfully.')
    })
}

function addLocalTracks(peer) {
  // getTracks() : MediaStream의 Track Set의 MediaStreamTrack objects를 반환
  localStream.getTracks().forEach(track => {
    // 타인에게 전송될 media track 추가
    peer.addTrack(track, localStream)
  })
}

// 신규 유저 소켓 접속 시, 신규 유저 액션
// 소켓에 action: 'new-answer' 메세지 전송
function createAnswerer(offer, peerUsername, receiver_channel_name){
  // RTCPeerConnection 객체 생성
  var peer = new RTCPeerConnection(null)

  // local Media Track, peer에 추가
  addLocalTracks(peer)

  // <video> 요소 생성
  var remoteVideo = createVideo(peerUsername)
  // 생성한 remoteVideo, peer에 있는 track과 연결
  setOnTrack(peer, remoteVideo)

  // For Chat
  // peer.addEventListener('datachannel', e => {
  //   peer.dc = e.channel
  //   peer.dc.addEventListener('open', () => {
  //     console.log('Connetion opened!')
  //   })
  //   peer.dc.addEventListener('message', dcOnMessage)

  //   mapPeers[peerUsername] = [peer, peer.dc]
  // })

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
      // console.log('New ice candidate: ', JSON.stringify(peer.localDescription))

      return
    }

    sendSignal('new-answer', {
      'sdp': peer.localDescription,
      'receiver_channel_name': receiver_channel_name
    })
  })

  console.log('setRemoteDescription(offer) : ', offer)
  console.log('check my sdp :', peer.localDescription)
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

// peer에 message 전송하는 이벤트 콜백
function dcOnMessage(event){
  // peer 메세지 전송 이벤트 
  var message = event.data

  console.log('dcOnMessage : ' + message) 

  var newLi = document.createElement('li')
  newLi.appendChild(document.createTextNode(message))
  messageList.appendChild(newLi)
}

// peer의 remoteVideo 요소를 HTML에 추가하기 위한 콜백
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

// remoteVideo 요소에 peer stream 연결하는 콜백
function setOnTrack(peer, remoteVideo){
  // MediaStream 객체 생성
  var remoteStream = new MediaStream()

  // remoteVideo에 스트림 연결
  remoteVideo.srcObject = remoteStream
  
  // ontrack event handler로부터 전송받은 new track
  // == ontrack = (event) => {};
  peer.addEventListener('track', async (event) => {
    // 전송 받은 event.track을 remoteStream에 추가
    remoteStream.addTrack(event.track, remoteStream)
  })
}

// RTCPeerConnection이 failed, disconnected, closed 되었을때,
// <video> 삭제
function removeVideo(video) {
  var videoWrapper = video.parentNode

  videoWrapper.parentNode.removeChild(videoWrapper)
}


// Chat Message
var btnSendMsg = document.getElementById('btn-send-msg')
var messageList = document.getElementById('message-list')
var messageInput = document.getElementById('msg')

btnSendMsg.addEventListener('click', sendMsgOnClick)

function sendMsgOnClick(){
  console.log('===== sendMsgOnClick()! =====')

  var message = messageInput.value

  var newLi = document.createElement('li')
  newLi.appendChild(document.createTextNode('Me: ' + message))
  messageList.appendChild(newLi)

  var dataChannels = getDataChannels()

  console.log(dataChannels)

  message = username + ': ' + message

  console.log('msg : ' + message) 

  for(index in dataChannels){
    dataChannels[index].send(message)
  }

  // Clear the message input
  messageInput.value = '' 
}

function getDataChannels() {
  console.log('===== getDataChannels()! =====')

  var dataChannels = []

  for(peerUsername in mapPeers){
    console.log('peerUsername : ' + peerUsername)
    var dataChannel = mapPeers[peerUsername][1]

    dataChannels.push(dataChannel)
  }

  return dataChannels
}