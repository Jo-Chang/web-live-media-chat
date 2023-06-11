import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'Test-Room'
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        print(self.channel_name)
        print(self.room_group_name)

    async def disonnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        print('Disconnected!')
            
    async def receive(self, text_data):
        receive_dict = json.loads(text_data)
        message = receive_dict['message']
        action = receive_dict['action']
        
        print('action : ' + action)
        print(receive_dict)
        
        if (action == 'new-offer') or (action == 'new-answer'):
            
            if action == 'new-offer':
                print(receive_dict['peer'], 'my sdp : ', receive_dict['message']['sdp'])
            if action == 'new-answer':
                print(receive_dict['peer'], 'your sdp : ', receive_dict['message']['sdp'])
            receiver_channel_name = receive_dict['message']['receiver_channel_name']
            
            receive_dict['message']['receiver_channel_name'] = self.channel_name
            
            
            await self.channel_layer.send(
                # self.room_group_name
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': receive_dict
                }
            )
            
            return
            
        receive_dict['message']['receiver_channel_name'] = self.channel_name
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send.sdp',
                # 'message': message,
                'receive_dict': receive_dict
            }
        )
        
    async def send_sdp(self, event):
        # message = event['message']
        
        # await self.send(text_data=json.dumps({
        #     'message': message,
        # }))
        receive_dict = event['receive_dict']
        await self.send(text_data=json.dumps(receive_dict))