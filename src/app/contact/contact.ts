import { Component } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-contact',
  styleUrl: './contact.css',
  templateUrl: './contact.html',
})
export class Contact {
 formData ={
 name: '',
 email:'',
 phone:'',
 subject:'',
 message:''
}

onSubmit(){
  console.log(this.formData);
}
}
